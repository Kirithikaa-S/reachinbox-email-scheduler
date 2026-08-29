import { redisConnection } from '../config/redis';
import { env } from '../config/env';

/**
 * Redis-backed rate limiting for email sending.
 *
 * DESIGN
 * ------
 * 1. Hourly limit per sender:
 *    Key:  email-rate:{senderId}:{YYYY-MM-DD-HH}
 *    We use an atomic Redis INCR against this key. INCR returns the new
 *    value, so the worker that pushes the counter past the configured
 *    limit is unambiguously the one that must reschedule (no read-then-write
 *    race). The key is given a TTL of 2 hours so old counters are cleaned
 *    up automatically without a separate sweep job.
 *
 *    This works correctly across multiple worker processes / backend
 *    instances because the counter lives in Redis, not in process memory,
 *    and INCR is atomic at the Redis server level.
 *
 * 2. Minimum delay between sends (global, per sender):
 *    Key:  email-min-delay:{senderId}
 *    Implemented with `SET key 1 PX <minDelayMs> NX`. Only one worker can
 *    acquire this "slot" per window; everyone else who fails to acquire it
 *    is told to wait (and the worker re-delays the BullMQ job rather than
 *    busy-waiting in-process). This avoids relying on in-memory timers,
 *    which would not coordinate across multiple worker processes.
 *
 * TRADE-OFFS
 * ----------
 * - The hourly window is a fixed clock-hour bucket (not a rolling window).
 *   This is simpler and sufficiently fair for this assignment; a rolling
 *   window (e.g. Redis sorted sets) would smooth bursts at hour boundaries
 *   at the cost of more complexity.
 * - The min-delay lock is best-effort ordering, not a strict global queue:
 *   under heavy concurrency, jobs that lose the lock are re-delayed by
 *   `minDelayMs` and retried, which preserves approximate ordering without
 *   requiring a distributed queue/mutex.
 */

function hourBucketKey(senderId: string, date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `email-rate:${senderId}:${y}-${m}-${d}-${h}`;
}

function minDelayKey(senderId: string): string {
  return `email-min-delay:${senderId}`;
}

export interface HourlyLimitCheck {
  allowed: boolean;
  count: number;
  limit: number;
  msUntilNextHour: number;
}

/**
 * Atomically increments the hourly counter for a sender and reports whether
 * this send is allowed under the given limit. Call this exactly once per
 * send attempt (i.e. right before actually sending).
 */
export async function checkAndIncrementHourlyLimit(
  senderId: string,
  hourlyLimit: number
): Promise<HourlyLimitCheck> {
  const key = hourBucketKey(senderId);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    // First increment in this bucket - set expiry (2h safety margin).
    await redisConnection.expire(key, 60 * 60 * 2);
  }

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  const msUntilNextHour = nextHour.getTime() - now.getTime();

  if (count > hourlyLimit) {
    // We over-shot: this send must be rescheduled. Decrement back so the
    // counter accurately reflects sends that actually went out.
    await redisConnection.decr(key);
    return { allowed: false, count: count - 1, limit: hourlyLimit, msUntilNextHour };
  }

  return { allowed: true, count, limit: hourlyLimit, msUntilNextHour };
}

/**
 * Tries to acquire the "may send now" slot for a sender, honoring the
 * configured minimum delay between sends. Returns true if the caller may
 * proceed immediately, false if it should back off and retry later.
 */
export async function tryAcquireMinDelaySlot(
  senderId: string,
  minDelayMs: number = env.MIN_EMAIL_DELAY_MS
): Promise<boolean> {
  if (minDelayMs <= 0) return true;
  const key = minDelayKey(senderId);
  const result = await redisConnection.set(key, '1', 'PX', minDelayMs, 'NX');
  return result === 'OK';
}

export function computeNextHourWindow(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return next;
}
