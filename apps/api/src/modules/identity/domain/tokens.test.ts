import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from './tokens.js';

describe('generateToken', () => {
  it('decodes back to 32 random bytes', () => {
    const token = generateToken();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('stays url safe and unpadded', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));

    expect(tokens.size).toBe(50);
  });
});

describe('hashToken', () => {
  it('matches the known sha-256 vector of its input', () => {
    // SHA-256 of "abc", the standard test vector: the hash is not re-implemented, it is checked.
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes a generated token to 64 lowercase hex characters, not to the token', () => {
    const token = generateToken();
    const hash = hashToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
  });

  it('gives two different tokens two different hashes', () => {
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });
});
