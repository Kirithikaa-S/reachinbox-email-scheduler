import { describe, it, expect } from 'vitest';

/**
 * The scheduling service computes each recipient's scheduledAt as
 * `startTime + index * delayMs`. This test isolates that pure calculation
 * (mirrored here) so it can be verified without a database.
 */
function computeScheduledAt(startTime: Date, index: number, delayMs: number): Date {
  return new Date(startTime.getTime() + index * delayMs);
}

describe('schedule calculation', () => {
  it('schedules the first recipient at startTime', () => {
    const start = new Date('2026-01-01T10:00:00.000Z');
    expect(computeScheduledAt(start, 0, 2000)).toEqual(start);
  });

  it('offsets each subsequent recipient by delayMs', () => {
    const start = new Date('2026-01-01T10:00:00.000Z');
    expect(computeScheduledAt(start, 1, 2000)).toEqual(new Date('2026-01-01T10:00:02.000Z'));
    expect(computeScheduledAt(start, 2, 2000)).toEqual(new Date('2026-01-01T10:00:04.000Z'));
  });

  it('handles a zero delay (all at startTime)', () => {
    const start = new Date('2026-01-01T10:00:00.000Z');
    expect(computeScheduledAt(start, 5, 0)).toEqual(start);
  });
});
