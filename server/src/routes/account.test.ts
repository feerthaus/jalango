import { describe, expect, it } from 'vitest';
import { feedbackSchema, tokenHash } from './account.js';

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

describe('reply code', () => {
  it('takes a device code of the right shape and stores only its SHA-256', () => {
    const code = 'aB3_-xY9aB3_-xY9aB3_-xY9';
    expect(feedbackSchema.parse({ category: 'idea', message: 'Add arrows', replyToken: code }).replyToken).toBe(code);
    expect(feedbackSchema.safeParse({ category: 'idea', message: 'Add arrows', replyToken: 'short' }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: 'idea', message: 'Add arrows', replyToken: "x' or 1=1 --xxxxxxxxxxxx" }).success).toBe(false);
    expect(tokenHash(code)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash(code)).not.toContain(code);
  });
});
