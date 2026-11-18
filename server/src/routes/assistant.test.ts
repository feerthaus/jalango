import { describe, expect, it } from 'vitest';
import { assistantSchema } from './assistant.js';

describe('assistant request', () => {
  it('needs a question last, short turns, and a location in Malaysia', () => {
    expect(assistantSchema.safeParse({ messages: [{ role: 'user', text: 'Ke KLIA?' }] }).success).toBe(true);
    expect(assistantSchema.safeParse({ messages: [{ role: 'assistant', text: 'Hi' }] }).success).toBe(false);
    expect(assistantSchema.safeParse({ messages: [{ role: 'user', text: 'a'.repeat(601) }] }).success).toBe(false);
    expect(assistantSchema.safeParse({ messages: Array.from({ length: 11 }, () => ({ role: 'user', text: 'x' })) }).success).toBe(false);
    expect(assistantSchema.safeParse({ messages: [{ role: 'user', text: 'x' }], near: { lat: 51.5, lng: -0.1 } }).success).toBe(false);
    expect(assistantSchema.parse({ messages: [{ role: 'user', text: 'x' }] }).lang).toBe('ms');
  });
});
