import { describe, expect, it } from 'vitest';
import { profilePhoto } from './profilePhoto';

describe('profile photo', () => {
  it('uses the photo the sign-in provider shared', () => {
    expect(profilePhoto({ avatar_url: 'https://lh3.googleusercontent.com/a/abc=s96-c' })).toBe('https://lh3.googleusercontent.com/a/abc=s96-c');
    expect(profilePhoto({ picture: 'https://lh3.googleusercontent.com/a/xyz' })).toBe('https://lh3.googleusercontent.com/a/xyz');
  });
  it('ignores anything that is not a plain https address', () => {
    expect(profilePhoto(undefined)).toBeNull();
    expect(profilePhoto({})).toBeNull();
    expect(profilePhoto({ avatar_url: 'http://example.com/a.png' })).toBeNull();
    expect(profilePhoto({ avatar_url: 'javascript:alert(1)' })).toBeNull();
    expect(profilePhoto({ avatar_url: 42 })).toBeNull();
  });
});
