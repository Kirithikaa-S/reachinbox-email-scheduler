const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extracts unique, valid email addresses from raw CSV or plain-text content.
 * Works whether the file is a bare list of addresses or a CSV with headers
 * like "name,email" - we don't need to understand columns, just find every
 * token that looks like a valid email address.
 */
export function extractEmailsFromText(content: string): string[] {
  const matches = content.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
  return unique;
}
