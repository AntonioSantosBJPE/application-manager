import { describe, expect, it } from 'vitest';
import { isAcceptablePassword, normalizeEmail } from './credentials.js';

describe('normalizeEmail', () => {
  it('lowercases and trims so the same person matches one account', () => {
    expect(normalizeEmail('  Ana.Silva@Example.COM ')).toBe('ana.silva@example.com');
  });

  it('leaves an already normalized email untouched', () => {
    expect(normalizeEmail('ana.silva@example.com')).toBe('ana.silva@example.com');
  });

  it('trims every kind of surrounding whitespace, keeping the inside', () => {
    expect(normalizeEmail('\tana silva@example.com\n')).toBe('ana silva@example.com');
  });
});

describe('isAcceptablePassword', () => {
  it('rejects 11 characters and accepts 12', () => {
    expect(isAcceptablePassword('a'.repeat(11))).toBe(false);
    expect(isAcceptablePassword('a'.repeat(12))).toBe(true);
  });

  it('accepts 128 characters and rejects 129', () => {
    expect(isAcceptablePassword('a'.repeat(128))).toBe(true);
    expect(isAcceptablePassword('a'.repeat(129))).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(isAcceptablePassword('')).toBe(false);
  });

  it('applies no composition rule: a long run of one character is accepted', () => {
    expect(isAcceptablePassword('x'.repeat(40))).toBe(true);
    expect(isAcceptablePassword('123456789012')).toBe(true);
  });
});
