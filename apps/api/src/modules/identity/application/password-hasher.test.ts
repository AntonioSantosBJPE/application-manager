import { describe, expect, it } from 'vitest';
import { argon2idPasswordHasher } from './password-hasher.js';

const password = 'correct-horse-battery';

describe('password hasher', () => {
  it('stores argon2id phc with m=19456 t=2 p=1', async () => {
    const phc = await argon2idPasswordHasher.hash(password);

    expect(phc).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
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
    await expect(argon2idPasswordHasher.verify('$argon2i$v=19$m=19456,t=2,p=1$c2FsdA==$dGFn', password)).resolves.toBe(
      false,
    );
  });

  it('verifyDummy always answers false, whatever it is given', async () => {
    await expect(argon2idPasswordHasher.verifyDummy(password)).resolves.toBe(false);
    await expect(argon2idPasswordHasher.verifyDummy('')).resolves.toBe(false);
  });
});
