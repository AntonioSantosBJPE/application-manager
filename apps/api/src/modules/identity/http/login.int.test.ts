import { randomBytes } from 'node:crypto';
import type { Argon2Algorithm, Argon2Parameters } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

/**
 * Every Argon2 derivation the API asks `node:crypto` for, recorded before the real one runs. The
 * module stays real: the test proves the work a login costs, not that a wrapper was called (AUTH-04).
 */
const derivations = vi.hoisted(() => ({
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
      derivations.algorithms.push(algorithm);
      derivations.parameters.push(parameters);
      return actual.argon2(algorithm, parameters, callback);
    },
  };
});

const password = 'correct-horse-battery';

interface UserFixture {
  id: string;
  email: string;
  salt: string;
}

/** A user written with the real hasher: the login meets a hash produced the way production does. */
async function createUser(databaseUrl: string, email: string, role: 'admin' | 'member'): Promise<UserFixture> {
  const passwordHash = await argon2idPasswordHasher.hash(password);
  const [row] = await query<{ id: string; email: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id, email',
    [email, role === 'admin' ? 'Admin' : 'Ana', passwordHash, role],
  );
  // The salt of the stored hash, in the unpadded form the PHC writes, so a test can tell against
  // which hash a derivation ran (AUTH-04).
  return { ...row!, salt: passwordHash.split('$')[4]! };
}

/** Ignores the derivations made by the fixtures, so an assertion counts only the login's own work. */
function forgetDerivations(): void {
  derivations.algorithms.length = 0;
  derivations.parameters.length = 0;
}

/** The salt the derivation used, as bytes; the declared type also allows a string or an ArrayBuffer. */
function saltOf(parameters: Argon2Parameters): Buffer {
  return Buffer.from(parameters.nonce as Uint8Array);
}

/** The cost of every derivation recorded, in the shape the spec states it (AUTH-05). */
function recordedCosts() {
  return derivations.parameters.map((parameters) => ({
    memory: parameters.memory,
    passes: parameters.passes,
    parallelism: parameters.parallelism,
    // PHC writes base64 without padding, so the salt is compared the way the hash carries it.
    nonce: saltOf(parameters).toString('base64').replace(/[=]+$/, ''),
  }));
}

const productionCost = { memory: 19456, passes: 2, parallelism: 1 };

function login(baseUrl: string, body: unknown, path = '/auth/login', headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** The cookie value the answer set, which is the session token the browser would send back. */
function sessionTokenOf(response: Response): string {
  const cookie = response.headers.get('set-cookie') ?? '';
  return /^am_session=([^;]+)/.exec(cookie)?.[1] ?? '';
}

async function sessionsOf(databaseUrl: string, userId: string): Promise<{ token_hash: string }[]> {
  return query<{ token_hash: string }>(databaseUrl, 'select token_hash from identity.sessions where user_id = $1', [
    userId,
  ]);
}

describe('POST /auth/login', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'login');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('creates a session sets the cookie and answers 204 for a member', async () => {
    const member = await createUser(database.url, 'member-login@example.com', 'member');
    const api = await startApi(database.url);
    try {
      const response = await login(api.baseUrl, { email: member.email, password });

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      const cookie = response.headers.get('set-cookie')!;
      expect(cookie).toMatch(/^am_session=/);
      expect(cookie).toContain('HttpOnly');

      // The session exists in the table, and the database keeps only the hash of the token it sent.
      const token = sessionTokenOf(response);
      expect(token).not.toBe('');
      const rows = await sessionsOf(database.url, member.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.token_hash).toBe(hashToken(token));
    } finally {
      await api.close();
    }
  });

  it('deletes only the expired sessions of the user', async () => {
    const member = await createUser(database.url, 'member-expired@example.com', 'member');
    const other = await createUser(database.url, 'member-other@example.com', 'member');
    const api = await startApi(database.url);
    try {
      // One session of each kind, written straight into the table: expired, still valid, and somebody else's.
      const expired = hashToken(randomBytes(32).toString('base64url'));
      const valid = hashToken(randomBytes(32).toString('base64url'));
      const foreign = hashToken(randomBytes(32).toString('base64url'));
      await query(database.url, "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() - interval '1 day')", [member.id, expired]);
      await query(database.url, "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '10 days')", [member.id, valid]);
      await query(database.url, "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() - interval '1 day')", [other.id, foreign]);

      expect((await login(api.baseUrl, { email: member.email, password })).status).toBe(204);

      const hashes = (await sessionsOf(database.url, member.id)).map((row) => row.token_hash);
      expect(hashes).not.toContain(expired);
      expect(hashes).toContain(valid);
      // The new session is the third row of this user: the expired one went, the valid one stayed.
      expect(hashes).toHaveLength(2);
      expect(await sessionsOf(database.url, other.id)).toHaveLength(1);
    } finally {
      await api.close();
    }
  });

  it('normalizes case and surrounding spaces of the email', async () => {
    const member = await createUser(database.url, 'ana.normalized@example.com', 'member');
    const api = await startApi(database.url);
    try {
      const response = await login(api.baseUrl, { email: '  ANA.Normalized@Example.COM  ', password });

      expect(response.status).toBe(204);
      const token = sessionTokenOf(response);
      expect((await sessionsOf(database.url, member.id)).map((row) => row.token_hash)).toEqual([hashToken(token)]);
      // Normalizing compares, it does not write: the stored email stays the one it was created with.
      const [stored] = await query<{ email: string }>(database.url, 'select email from identity.users where id = $1', [member.id]);
      expect(stored!.email).toBe('ana.normalized@example.com');
    } finally {
      await api.close();
    }
  });
});

describe('POST /auth/admin/login', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'admin_login');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('creates a session sets the cookie and answers 204 for an admin', async () => {
    const admin = await createUser(database.url, 'admin-login@example.com', 'admin');
    const api = await startApi(database.url);
    try {
      const response = await login(api.baseUrl, { email: admin.email, password }, '/auth/admin/login');

      expect(response.status).toBe(204);
      const token = sessionTokenOf(response);
      expect(token).not.toBe('');
      expect((await sessionsOf(database.url, admin.id)).map((row) => row.token_hash)).toEqual([hashToken(token)]);
    } finally {
      await api.close();
    }
  });
});

/**
 * Every test builds its own accounts and comes from its own address, so no test inherits a failure
 * counter from another: a shared pair could reach the five-failure limit and turn a `401` into a `429`.
 */
describe('login failures', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'login_failures');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('answer an identical 401 for wrong password unknown email and wrong entrance', async () => {
    const member = await createUser(database.url, 'member-fail@example.com', 'member');
    const admin = await createUser(database.url, 'admin-fail@example.com', 'admin');
    const api = await startApi(database.url);
    const ip = '198.51.100.10';
    try {
      const attempts = [
        { name: 'wrong password', path: '/auth/login', body: { email: member.email, password: 'wrong-but-long-enough' } },
        { name: 'unknown email', path: '/auth/login', body: { email: 'nobody@example.com', password } },
        // Valid credentials of the other role on this entrance: refused, and it says nothing about the role.
        { name: 'admin at the member login', path: '/auth/login', body: { email: admin.email, password } },
        { name: 'member at the admin login', path: '/auth/admin/login', body: { email: member.email, password } },
      ];
      const answers = [];
      for (const attempt of attempts) {
        answers.push({ attempt, response: await login(api.baseUrl, attempt.body, attempt.path, { 'x-am-client-ip': ip }) });
      }

      for (const { attempt, response } of answers) {
        expect({ name: attempt.name, status: response.status }).toEqual({ name: attempt.name, status: 401 });
        expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }
      const bodies = await Promise.all(answers.map(async (answer) => await answer.response.text()));
      // Byte for byte: the four refusals cannot be told apart.
      expect(new Set(bodies).size).toBe(1);
      expect(JSON.parse(bodies[0]!)).toEqual({ type: 'about:blank', title: 'Unauthorized', status: 401 });

      // Nothing was issued: no session belongs to either account, and no cookie came back.
      expect(await sessionsOf(database.url, member.id)).toEqual([]);
      expect(await sessionsOf(database.url, admin.id)).toEqual([]);
      expect(answers[0]!.response.headers.get('set-cookie')).toBeNull();
    } finally {
      await api.close();
    }
  });

  it('runs the password verifier once for a known and an unknown email', async () => {
    const member = await createUser(database.url, 'member-hash@example.com', 'member');
    const api = await startApi(database.url);
    const ip = '198.51.100.20';
    try {
      forgetDerivations();
      expect(
        (await login(api.baseUrl, { email: member.email, password: 'wrong-but-long-enough' }, '/auth/login', { 'x-am-client-ip': ip })).status,
      ).toBe(401);

      // A known email costs exactly one real Argon2id derivation, against the salt of its own hash.
      expect(derivations.algorithms).toEqual(['argon2id']);
      expect(recordedCosts()).toEqual([{ ...productionCost, nonce: member.salt }]);

      forgetDerivations();
      expect((await login(api.baseUrl, { email: 'nobody@example.com', password }, '/auth/login', { 'x-am-client-ip': ip })).status).toBe(401);

      // The unknown email costs the very same work: one derivation, the same parameters, but against
      // the dummy hash, so nobody's stored password is checked (AUTH-04).
      expect(derivations.algorithms).toEqual(['argon2id']);
      expect(recordedCosts()).toEqual([{ ...productionCost, nonce: expect.any(String) }]);
      expect(recordedCosts()[0]!.nonce).not.toBe(member.salt);
    } finally {
      await api.close();
    }
  });

  it('a password above 128 characters gets the same 401 counts a failure and runs no argon2', async () => {
    const member = await createUser(database.url, 'member-long@example.com', 'member');
    const api = await startApi(database.url);
    const ip = '198.51.100.30';
    try {
      forgetDerivations();
      const response = await login(api.baseUrl, { email: member.email, password: 'a'.repeat(129) }, '/auth/login', {
        'x-am-client-ip': ip,
      });

      expect(response.status).toBe(401);
      // Not one derivation ran: the length rule is decided before the expensive work (EDGE-03).
      expect(derivations.parameters).toEqual([]);
      // It still counts as a failure, so an oversized password is no cheaper a guess than a wrong one.
      expect(
        await query<{ email: string }>(database.url, 'select email from identity.login_attempts where ip = $1', [ip]),
      ).toEqual([{ email: member.email }]);

      const wrong = await login(api.baseUrl, { email: member.email, password: 'wrong-but-long-enough' }, '/auth/login', {
        'x-am-client-ip': ip,
      });
      // The same answer a wrong password gets, so the length rule leaks nothing about the account.
      expect(await response.text()).toBe(await wrong.text());
      // Control: a wrong password inside the window does reach the derivation, so the check above is not vacuous.
      expect(derivations.parameters).toHaveLength(1);
    } finally {
      await api.close();
    }
  });
});
