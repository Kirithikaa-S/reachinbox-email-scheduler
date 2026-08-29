import { describe, it, expect } from 'vitest';
import { scheduleEmailSchema } from '../src/utils/validation';

describe('scheduleEmailSchema', () => {
  it('accepts a valid payload', () => {
    const result = scheduleEmailSchema.safeParse({
      subject: 'Hello',
      body: 'World',
      startTime: new Date().toISOString(),
      delayMs: 2000,
      hourlyLimit: 200,
      recipients: ['a@example.com', 'b@example.com'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty recipient list', () => {
    const result = scheduleEmailSchema.safeParse({
      subject: 'Hello',
      body: 'World',
      startTime: new Date().toISOString(),
      recipients: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email in recipients', () => {
    const result = scheduleEmailSchema.safeParse({
      subject: 'Hello',
      body: 'World',
      startTime: new Date().toISOString(),
      recipients: ['not-an-email'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid startTime', () => {
    const result = scheduleEmailSchema.safeParse({
      subject: 'Hello',
      body: 'World',
      startTime: 'not-a-date',
      recipients: ['a@example.com'],
    });
    expect(result.success).toBe(false);
  });

  it('defaults delayMs and hourlyLimit when omitted', () => {
    const result = scheduleEmailSchema.parse({
      subject: 'Hello',
      body: 'World',
      startTime: new Date().toISOString(),
      recipients: ['a@example.com'],
    });
    expect(result.delayMs).toBe(2000);
    expect(result.hourlyLimit).toBe(200);
  });
});
