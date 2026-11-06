import { describe, expect, it } from 'vitest';
import { feedbackSchema } from './account.js';

describe('feedbackSchema', () => {
  it('accepts valid feedback and trims', () => {
    const r = feedbackSchema.parse({ category: 'bug', message: '  Voice too quiet  ' });
    expect(r.message).toBe('Voice too quiet');
  });
  it('rejects empty, too long or unknown category', () => {
    expect(feedbackSchema.safeParse({ category: 'bug', message: 'hi' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: 'bug', message: 'x'.repeat(2001) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: 'spam', message: 'hello there' }).success).toBe(false);
  });
});
