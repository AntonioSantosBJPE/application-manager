import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher, type PasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

const password = 'correct-horse-battery';

interface UserFixture {
  id: string;
  email: string;
}

/** A user written with the real hasher: the login meets a hash produced the way production does. */
async function createUser(databaseUrl: string, email: string, role: 'admin' | 'member'): Promise<UserFixture> {
  const passwordHash = await argon2idPasswordHasher.hash(password);
  const [row] = await query<{ id: string; email: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id, email',
    [email, role === 'admin' ? 'Admin' : 'Ana', passwordHash, role],
  );
  return row!;
}

/** Records every call it receives and delegates to the real hasher: the work a login asked for. */
function countingHasher(): PasswordHasher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    hash: (raw) => argon2idPasswordHasher.hash(raw),
    verify: (phc, raw) => {
      calls.push('verify');
      return argon2idPasswordHasher.verify(phc, raw);
    },
    verifyDummy: (raw) => {
      calls.push('verifyDummy');
      return argon2idPasswordHasher.verifyDummy(raw);
    },
  };
}

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

describe('login failures', () => {
  let database: TestDatabase;
  let member: UserFixture;
  let admin: UserFixture;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'login_failures');
    member = await createUser(database.url, 'member-fail@example.com', 'member');
    admin = await createUser(database.url, 'admin-fail@example.com', 'admin');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('answer an identical 401 for wrong password unknown email and wrong entrance', async () => {
    const hasher = countingHasher();
    const api = await startApi(database.url, { passwordHasher: hasher });
    try {
      const attempts = [
        { name: 'wrong password', path: '/auth/login', body: { email: member.email, password: 'wrong-but-long-enough' } },
        { name: 'unknown email', path: '/auth/login', body: { email: 'nobody@example.com', password } },
        // Valid credentials of the other role on this entrance: refused, and it says nothing about the role.
        { name: 'wrong entrance', path: '/auth/login', body: { email: admin.email, password } },
      ];
      const answers = [];
      for (const attempt of attempts) answers.push({ attempt, response: await login(api.baseUrl, attempt.body, attempt.path) });

      for (const { attempt, response } of answers) {
        expect({ name: attempt.name, status: response.status }).toEqual({ name: attempt.name, status: 401 });
        expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }
      const bodies = await Promise.all(answers.map(async (answer) => answer.response.text()));
      // Byte for byte: the three refusals cannot be told apart.
      expect(new Set(bodies).size).toBe(1);
      expect(JSON.parse(bodies[0]!)).toEqual({ type: 'about:blank', title: 'Unauthorized', status: 401 });

      // Nothing was issued: no session belongs to either account.
      expect(await sessionsOf(database.url, member.id)).toEqual([]);
      expect(await sessionsOf(database.url, admin.id)).toEqual([]);
      expect(answers[0]!.response.headers.get('set-cookie')).toBeNull();
    } finally {
      await api.close();
    }
  });

  it('runs the password verifier once for a known and an unknown email', async () => {
    const hasher = countingHasher();
    const api = await startApi(database.url, { passwordHasher: hasher });
    try {
      expect((await login(api.baseUrl, { email: member.email, password: 'wrong-but-long-enough' })).status).toBe(401);
      // A known email costs one verification against its own hash.
      expect(hasher.calls).toEqual(['verify']);

      hasher.calls.length = 0;
      expect((await login(api.baseUrl, { email: 'nobody@example.com', password })).status).toBe(401);

      // The unknown email costs exactly one verification too, against the dummy hash, and never a real one.
      expect(hasher.calls).toEqual(['verifyDummy']);
    } finally {
      await api.close();
    }
  });

  it('a password above 128 characters gets the same 401 counts a failure and runs no argon2', async () => {
    const hasher = countingHasher();
    const api = await startApi(database.url, { passwordHasher: hasher });
    const ip = '198.51.100.30';
    try {
      await query(database.url, 'delete from identity.login_attempts');
      const response = await login(api.baseUrl, { email: member.email, password: 'a'.repeat(129) }, '/auth/login', {
        'x-am-client-ip': ip,
      });

      expect(response.status).toBe(401);
      // Not one hash was computed: the length rule is decided before the expensive work (EDGE-03).
      expect(hasher.calls).toEqual([]);
      // It still counts as a failure, so an oversized password is no cheaper a guess than a wrong one.
      expect(
        await query<{ email: string }>(database.url, 'select email from identity.login_attempts where ip = $1', [ip]),
      ).toEqual([{ email: member.email }]);

      hasher.calls.length = 0;
      const wrong = await login(api.baseUrl, { email: member.email, password: 'wrong-but-long-enough' }, '/auth/login', {
        'x-am-client-ip': ip,
      });
      // The same answer a wrong password gets, so the length rule leaks nothing about the account.
      expect(await response.text()).toBe(await wrong.text());
      // Control: a wrong password inside the window does reach the hasher, so the check above is not vacuous.
      expect(hasher.calls).toEqual(['verify']);
    } finally {
      await api.close();
    }
  });
});
