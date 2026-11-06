import { describe, expect, it, vi } from 'vitest';
import type { Argon2Algorithm, Argon2Parameters } from 'node:crypto';

/**
 * Every derivation the module asks `node:crypto` for, recorded before the real function runs, so a
 * test can prove which parameters a check costs (AUTH-04, AUTH-05). Everything else of the module
 * stays real: tokens and the database keep using the actual implementation.
 */
const recorded = vi.hoisted(() => ({
  algorithms: [] as Argon2Algorithm[],
  parameters: [] as Argon2Parameters[],
}));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    argon2: (
      algorithm: Argon2Algorithm,
      parameters: Argon2Parameters,
      callback: (error: Error | null, derived: Buffer) => void,
    ) => {
      recorded.algorithms.push(algorithm);
      recorded.parameters.push(parameters);
      return actual.argon2(algorithm, parameters, callback);
    },
  };
});

const { argon2idPasswordHasher } = await import('./password-hasher.js');

const password = 'correct-horse-battery';

/** The parameters of one recorded derivation, in the shape the spec states them (AUTH-05). */
function costOf(parameters: Argon2Parameters) {
  return {
    memory: parameters.memory,
    passes: parameters.passes,
    parallelism: parameters.parallelism,
    tagLength: parameters.tagLength,
    // The salt is a buffer in this module, though the declared type also allows a string or an ArrayBuffer.
    nonceLength: Buffer.from(parameters.nonce as Uint8Array).length,
  };
}

describe('password hasher', () => {
  it('stores argon2id phc with m=19456 t=2 p=1', async () => {
    const phc = await argon2idPasswordHasher.hash(password);

    expect(phc).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    // A 16 byte salt and a 32 byte tag, in base64 without padding lost.
    const [, , , , salt, tag] = phc.split('$');
    expect(Buffer.from(salt!, 'base64')).toHaveLength(16);
    expect(Buffer.from(tag!, 'base64')).toHaveLength(32);
  });

  it('verifies the right password and refuses a wrong one', async () => {
    const phc = await argon2idPasswordHasher.hash(password);

    await expect(argon2idPasswordHasher.verify(phc, password)).resolves.toBe(true);
    await expect(argon2idPasswordHasher.verify(phc, 'correct-horse-batterY')).resolves.toBe(false);
    await expect(argon2idPasswordHasher.verify(phc, '')).resolves.toBe(false);
  });

  it('uses a new salt every time, so the same password hashes differently', async () => {
    const first = await argon2idPasswordHasher.hash(password);
    const second = await argon2idPasswordHasher.hash(password);

    expect(first).not.toBe(second);
    expect(first.split('$')[4]).not.toBe(second.split('$')[4]);
    // Both still verify: the salt is stored with the hash, not with the password.
    await expect(argon2idPasswordHasher.verify(second, password)).resolves.toBe(true);
  });

  it('refuses a hash it cannot parse instead of throwing', async () => {
    await expect(argon2idPasswordHasher.verify('not-a-phc-hash', password)).resolves.toBe(false);
    await expect(
      argon2idPasswordHasher.verify('$argon2i$v=19$m=19456,t=2,p=1$c2FsdA==$dGFn', password),
    ).resolves.toBe(false);
  });

  it('verifyDummy always answers false, whatever it is given', async () => {
    await expect(argon2idPasswordHasher.verifyDummy(password)).resolves.toBe(false);
    await expect(argon2idPasswordHasher.verifyDummy('')).resolves.toBe(false);
  });

  it('verifyDummy derives once with the production parameters, not a cheaper placeholder', async () => {
    recorded.algorithms.length = 0;
    recorded.parameters.length = 0;

    await expect(argon2idPasswordHasher.verifyDummy(password)).resolves.toBe(false);

    // One real Argon2id derivation: an answer of `false` with no work behind it would be a timing clue (AUTH-04).
    expect(recorded.algorithms).toEqual(['argon2id']);
    expect(recorded.parameters).toHaveLength(1);
    expect(costOf(recorded.parameters[0]!)).toEqual({
      memory: 19456,
      passes: 2,
      parallelism: 1,
      tagLength: 32,
      nonceLength: 16,
    });
  });

  it('verify derives once with the parameters stored in the phc', async () => {
    const phc = await argon2idPasswordHasher.hash(password);
    recorded.algorithms.length = 0;
    recorded.parameters.length = 0;

    await argon2idPasswordHasher.verify(phc, password);

    expect(recorded.algorithms).toEqual(['argon2id']);
    expect(recorded.parameters).toHaveLength(1);
    expect(costOf(recorded.parameters[0]!)).toEqual({
      memory: 19456,
      passes: 2,
      parallelism: 1,
      tagLength: 32,
      nonceLength: 16,
    });
  });
});
