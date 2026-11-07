import { argon2, randomBytes, timingSafeEqual, type Argon2Parameters } from 'node:crypto';

/**
 * OWASP's Argon2id configuration: 19 MiB, two passes, one lane, a 16 byte salt and a 32 byte tag
 * (AUTH-05). The PHC string carries the parameters, so they can be raised later without losing the
 * hashes already stored.
 */
const algorithm = 'argon2id';
const memory = 19456;
const passes = 2;
const parallelism = 1;
const tagLength = 32;
const saltLength = 16;

/** A password hash in PHC form: `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<tag>`. */
export type PhcHash = string;

export interface PasswordHasher {
  hash(password: string): Promise<PhcHash>;
  verify(phc: PhcHash, password: string): Promise<boolean>;
  /** Burns the same work as a real check, so an unknown email answers as slowly as a wrong password (AUTH-04). */
  verifyDummy(password: string): Promise<boolean>;
}

/** DI token of the hasher, so a test can wrap the real one and count the work a login asked for (AUTH-04). */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

function derive(password: string, salt: Buffer, settings: { memory: number; passes: number; parallelism: number; tagLength: number }): Promise<Buffer> {
  const parameters: Argon2Parameters = {
    message: Buffer.from(password),
    nonce: salt,
    parallelism: settings.parallelism,
    tagLength: settings.tagLength,
    memory: settings.memory,
    passes: settings.passes,
  };
  return new Promise((resolve, reject) => {
    argon2(algorithm, parameters, (error, derived) => (error ? reject(error) : resolve(Buffer.from(derived!))));
  });
}

/** PHC writes base64 without the trailing padding; `Buffer.from` reads both forms. */
function unpadded(bytes: Buffer): string {
  return bytes.toString('base64').replace(/[=]+$/, '');
}

function toPhc(salt: Buffer, tag: Buffer, settings: { memory: number; passes: number; parallelism: number }): PhcHash {
  const params = `m=${settings.memory},t=${settings.passes},p=${settings.parallelism}`;
  return `$${algorithm}$v=19$${params}$${unpadded(salt)}$${unpadded(tag)}`;
}

interface ParsedPhc {
  salt: Buffer;
  tag: Buffer;
  settings: { memory: number; passes: number; parallelism: number; tagLength: number };
}

/** Reads the parameters back from the stored string, so a hash made with other settings still verifies. */
function parsePhc(phc: string): ParsedPhc | undefined {
  // ['', 'argon2id', 'v=19', 'm=...,t=...,p=...', salt, tag]
  const parts = phc.split('$');
  if (parts.length !== 6 || parts[0] !== '' || parts[1] !== algorithm || parts[2] !== 'v=19') return undefined;
  const settings = new Map(
    parts[3]!.split(',').map((pair) => {
      const [name, value] = pair.split('=');
      return [name, Number(value)] as const;
    }),
  );
  const read = (name: string) => settings.get(name);
  const [memoryCost, timeCost, lanes] = [read('m'), read('t'), read('p')];
  if (memoryCost === undefined || timeCost === undefined || lanes === undefined) return undefined;
  if (![memoryCost, timeCost, lanes].every((value) => Number.isInteger(value) && value > 0)) return undefined;
  const salt = Buffer.from(parts[4]!, 'base64');
  const tag = Buffer.from(parts[5]!, 'base64');
  if (salt.length === 0 || tag.length === 0) return undefined;
  return {
    salt,
    tag,
    settings: { memory: memoryCost, passes: timeCost, parallelism: lanes, tagLength: tag.length },
  };
}

/** A hash no password produces: the check against it costs what a real one costs and always fails. */
const dummyHash = toPhc(randomBytes(saltLength), randomBytes(tagLength), { memory, passes, parallelism });

export const argon2idPasswordHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(saltLength);
    const tag = await derive(password, salt, { memory, passes, parallelism, tagLength });
    return toPhc(salt, tag, { memory, passes, parallelism });
  },

  async verify(phc, password) {
    const parsed = parsePhc(phc);
    if (parsed === undefined) return false;
    const tag = await derive(password, parsed.salt, parsed.settings);
    return tag.length === parsed.tag.length && timingSafeEqual(tag, parsed.tag);
  },

  async verifyDummy(password) {
    const parsed = parsePhc(dummyHash)!;
    await derive(password, parsed.salt, parsed.settings);
    // The answer is always false; the work is the point (AUTH-04).
    return false;
  },
};
