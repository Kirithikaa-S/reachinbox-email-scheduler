import { describe, it, expect } from 'vitest';
import { emailJobId } from '../src/queues/emailQueue';

describe('emailJobId', () => {
  it('is deterministic for the same scheduled email id', () => {
    const id = 'abc-123';
    expect(emailJobId(id)).toBe(emailJobId(id));
  });

  it('produces different ids for different scheduled emails', () => {
    expect(emailJobId('abc')).not.toBe(emailJobId('def'));
  });

  it('is prefixed for readability in Bull Board', () => {
    expect(emailJobId('xyz')).toBe('email-xyz');
  });
});
