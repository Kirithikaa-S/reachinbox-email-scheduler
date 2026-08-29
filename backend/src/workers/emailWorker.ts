import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobPayload, rescheduleEmailJob } from '../queues/emailQueue';
import { sendMail } from '../smtp/etherealService';
import { indexEmailDocument, ensureEmailIndex } from '../elasticsearch/emailIndex';
import { checkAndIncrementHourlyLimit, tryAcquireMinDelaySlot } from '../ratelimit/rateLimiter';
import { notifyRateLimitReached } from '../slack/slackService';
import { logger } from '../utils/logger';

/**
 * EMAIL WORKER FLOW
 * -----------------
 * 1. Load the ScheduledEmail (+ sender + campaign owner) from MySQL.
 * 2. Idempotency guard: if status is already `sent`, do nothing and
 *    succeed. This makes re-delivery of the same BullMQ job (e.g. after a
 *    crash/retry) safe.
 * 3. Hourly rate limit: atomically increment the Redis counter for this
 *    sender's current hour bucket. If it would exceed the configured
 *    limit, push the job to the next hour window instead of failing it,
 *    and send a (throttled) Slack notification.
 * 4. Minimum delay: try to acquire a short-lived Redis lock enforcing the
 *    configured minimum spacing between sends for this sender. If another
 *    worker currently holds it, back off and retry shortly (re-delay,
 *    don't busy-wait).
 * 5. Atomically transition scheduled -> processing in MySQL using a
 *    conditional update (`updateMany` with a `status: 'scheduled'` filter)
 *    so two concurrent workers can't both proceed for the same email.
 * 6. Send via Ethereal, store the message ID + preview URL, mark `sent`.
 * 7. Re-index the document in Elasticsearch (best-effort).
 *
 * On failure, we mark the row `failed` (BullMQ will still retry the job
 * per its `attempts`/`backoff` config); on the final failed attempt we
 * leave the row in `failed` status rather than `scheduled`, so it does not
 * get silently retried forever outside BullMQ's own retry policy.
 */

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { scheduledEmailId } = job.data;

  const email = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: { sender: true, campaign: { include: { user: true } } },
  });

  if (!email) {
    logger.warn('ScheduledEmail not found - skipping', { scheduledEmailId });
    return;
  }

  // --- Idempotency guard -------------------------------------------------
  if (email.status === 'sent') {
    logger.info('Email already sent - skipping duplicate job', { id: email.id });
    return;
  }
  if (email.status === 'cancelled') {
    logger.info('Email cancelled - skipping', { id: email.id });
    return;
  }

  // --- Hourly rate limit ---------------------------------------------------
  const hourlyLimit = email.campaign.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const limitCheck = await checkAndIncrementHourlyLimit(email.senderId, hourlyLimit);

  if (!limitCheck.allowed) {
    const nextScheduledAt = new Date(Date.now() + limitCheck.msUntilNextHour);
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: { scheduledAt: nextScheduledAt, status: 'scheduled' },
    });
    await rescheduleEmailJob(email.id, limitCheck.msUntilNextHour);

    logger.info('Hourly limit reached - rescheduled to next hour', {
      id: email.id,
      senderId: email.senderId,
      nextScheduledAt,
    });

    await notifyRateLimitReached(
      email.campaign.userId,
      email.sender.email,
      email.senderId
    );
    return;
  }

  // --- Minimum delay between sends ---------------------------------------
  const acquired = await tryAcquireMinDelaySlot(email.senderId, env.MIN_EMAIL_DELAY_MS);
  if (!acquired) {
    // Someone else just sent for this sender; back off briefly and retry.
    await rescheduleEmailJob(email.id, env.MIN_EMAIL_DELAY_MS);
    logger.debug('Min-delay slot busy - re-delayed job', { id: email.id });
    return;
  }

  // --- Atomic scheduled -> processing transition --------------------------
  const claim = await prisma.scheduledEmail.updateMany({
    where: { id: email.id, status: 'scheduled' },
    data: { status: 'processing' },
  });

  if (claim.count === 0) {
    // Another worker already claimed this row.
    logger.debug('Email already claimed by another worker - skipping', { id: email.id });
    return;
  }

  try {
    const result = await sendMail({
      fromName: email.sender.name,
      fromEmail: email.sender.email,
      smtpUser: email.sender.etherealUser,
      smtpPassword: email.sender.etherealPassword,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    const sentAt = new Date();
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: {
        status: 'sent',
        sentAt,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        attempts: { increment: 1 },
      },
    });

    await indexEmailDocument({
      id: email.id,
      userId: email.campaign.userId,
      campaignId: email.campaignId,
      senderId: email.senderId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: 'sent',
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: sentAt.toISOString(),
      createdAt: email.createdAt.toISOString(),
    });

    logger.info('Email sent', { id: email.id, to: email.recipient, previewUrl: result.previewUrl });
  } catch (err) {
    const error = err as Error;
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        error: error.message,
        attempts: { increment: 1 },
      },
    });
    logger.error('Email send failed', { id: email.id, error: error.message });
    throw error; // let BullMQ apply its retry/backoff policy
  }
}

export const emailWorker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on('completed', (job) => {
  logger.debug('Job completed', { jobId: job.id });
});

emailWorker.on('failed', (job, err) => {
  logger.warn('Job failed', { jobId: job?.id, error: err.message });
});

if (require.main === module) {
  ensureEmailIndex().finally(() => {
    logger.info('Email worker started', { concurrency: env.WORKER_CONCURRENCY });
  });
}
