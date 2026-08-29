import { prisma } from '../config/prisma';
import { enqueueEmailJob } from '../queues/emailQueue';
import { indexEmailDocument } from '../elasticsearch/emailIndex';
import { ScheduleEmailInput } from '../utils/validation';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Ensures the user has at least one Sender. For this assignment, senders
 * are backed by shared Ethereal credentials from the environment unless
 * per-sender credentials are supplied (see README "Multiple Senders").
 */
async function getOrCreateDefaultSender(userId: string, userEmail: string) {
  const existing = await prisma.sender.findFirst({ where: { userId } });
  if (existing) return existing;

  const etherealUser = process.env.ETHEREAL_USER ?? '';
  const etherealPassword = process.env.ETHEREAL_PASSWORD ?? '';

  return prisma.sender.create({
    data: {
      userId,
      email: userEmail,
      name: 'Default Sender',
      etherealUser,
      etherealPassword,
    },
  });
}

export async function scheduleCampaign(userId: string, userEmail: string, input: ScheduleEmailInput) {
  const sender = input.senderId
    ? await prisma.sender.findFirst({ where: { id: input.senderId, userId } })
    : await getOrCreateDefaultSender(userId, userEmail);

  if (!sender) {
    throw new AppError('Sender not found', 404);
  }

  const startTime = new Date(input.startTime);

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      subject: input.subject,
      body: input.body,
      startTime,
      delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit,
      status: 'scheduled',
    },
  });

  const results = [];

  // Sequential creation keeps ordering simple/predictable for this
  // assignment's scale; each recipient's scheduledAt is offset by delayMs
  // from the previous one, preserving submission order.
  for (let i = 0; i < input.recipients.length; i++) {
    const recipient = input.recipients[i];
    const scheduledAt = new Date(startTime.getTime() + i * input.delayMs);

    const scheduledEmail = await prisma.scheduledEmail.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient,
        subject: input.subject,
        body: input.body,
        sequence: i,
        scheduledAt,
        status: 'scheduled',
      },
    });

    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
    const jobId = await enqueueEmailJob(scheduledEmail.id, delayMs);

    await prisma.scheduledEmail.update({
      where: { id: scheduledEmail.id },
      data: { bullJobId: jobId },
    });

    await indexEmailDocument({
      id: scheduledEmail.id,
      userId,
      campaignId: campaign.id,
      senderId: sender.id,
      recipient,
      subject: input.subject,
      body: input.body,
      status: 'scheduled',
      scheduledAt: scheduledAt.toISOString(),
      sentAt: null,
      createdAt: scheduledEmail.createdAt.toISOString(),
    });

    results.push(scheduledEmail);
  }

  logger.info('Campaign scheduled', {
    campaignId: campaign.id,
    recipients: input.recipients.length,
  });

  return { campaign, emails: results };
}
