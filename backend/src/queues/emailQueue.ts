import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'send-email';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5000 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

/**
 * Deterministic job ID so that re-adding a job for the same scheduled email
 * never creates a duplicate. BullMQ enforces job ID uniqueness per queue.
 */
export function emailJobId(scheduledEmailId: string): string {
  return `email-${scheduledEmailId}`;
}

export interface EmailJobPayload {
  scheduledEmailId: string;
}

export async function enqueueEmailJob(
  scheduledEmailId: string,
  delayMs: number
): Promise<string> {
  const jobId = emailJobId(scheduledEmailId);
  const job = await emailQueue.add(
    EMAIL_QUEUE_NAME,
    { scheduledEmailId } as EmailJobPayload,
    {
      jobId,
      delay: Math.max(0, delayMs),
    }
  );
  return job.id as string;
}

/**
 * Reschedule an existing job (used when the hourly rate limit is hit).
 * BullMQ does not allow re-adding a job with the same jobId while it still
 * exists, so we remove the old one (if present) and add a fresh delayed job
 * with the same deterministic ID.
 */
export async function rescheduleEmailJob(
  scheduledEmailId: string,
  delayMs: number
): Promise<string> {
  const jobId = emailJobId(scheduledEmailId);
  const existing = await emailQueue.getJob(jobId);
  if (existing) {
    try {
      await existing.remove();
    } catch {
      // If it's already being processed/removed, ignore - we'll still add fresh.
    }
  }
  return enqueueEmailJob(scheduledEmailId, delayMs);
}
