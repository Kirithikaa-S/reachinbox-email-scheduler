import { describe, it, expect } from 'vitest';
import { extractEmailsFromText } from '../src/utils/emailParser';

describe('extractEmailsFromText', () => {
  it('extracts emails from a bare list', () => {
    const input = 'john@example.com\njane@example.com';
    expect(extractEmailsFromText(input)).toEqual(['john@example.com', 'jane@example.com']);
  });

  it('extracts emails from a CSV with headers', () => {
    const input = 'name,email\nJohn,john@example.com\nJane,jane@example.com';
    const result = extractEmailsFromText(input);
    expect(result).toContain('john@example.com');
    expect(result).toContain('jane@example.com');
    expect(result).toHaveLength(2);
  });

  it('deduplicates and lowercases emails', () => {
    const input = 'A@Example.com, a@example.com, a@example.com';
    expect(extractEmailsFromText(input)).toEqual(['a@example.com']);
  });

  it('returns an empty array when no emails are present', () => {
    expect(extractEmailsFromText('no emails here')).toEqual([]);
  });
});
