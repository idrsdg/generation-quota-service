import { createHash } from 'node:crypto';

/** trim + lowercase + collapse whitespace runs into a single space. */
export function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prompts can be 2,000 characters long, so the key is a fixed-size hash. */
export function cacheKey(normalizedPrompt: string): string {
  return 'gen:v1:' + createHash('sha256').update(normalizedPrompt).digest('hex');
}

/** Counts Unicode code points, the same way PostgreSQL's char_length does. */
export function charLength(text: string): number {
  return [...text].length;
}
