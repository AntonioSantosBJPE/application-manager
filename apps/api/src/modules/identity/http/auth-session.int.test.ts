import { describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

const password = 'correct-horse-battery';

async function memberSession(databaseUrl: string, api: Awaited<ReturnType<typeof startApi>>) {
  const [user] = await query<{ id: string; email: string; name: string }>(
    databaseUrl,
    `insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member')
       returning id, email, name`,
    ['ana.me@example.com', 'Ana Souza', await argon2idPasswordHasher.hash(password)],
  );
  const login = await fetch(`${api.baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user!.email, password }),
  });
  expect(login.status).toBe(204);
  const token = /^am_session=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')![1]!;
  return { user: user!, token };
}

describe('GET /auth/me', () => {
  it('answers 200 with the session user', async () => {
    const database = await createMigratedDatabase(inject('databaseUrl'), 'me');
    const api = await startApi(database.url);
    try {
      const { user, token } = await memberSession(database.url, api);

      const response = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${token}` } });

      expect(response.status).toBe(200);
      // Exactly the four fields of the contract, taken from the session's user (AUTH-09).
      expect(await response.json()).toEqual({ id: user.id, email: 'ana.me@example.com', name: 'Ana Souza', role: 'member' });
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('answers 401 without a session', async () => {
    const database = await createMigratedDatabase(inject('databaseUrl'), 'me_anon');
    const api = await startApi(database.url);
    try {
      const response = await fetch(`${api.baseUrl}/auth/me`);

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session clears the cookie and answers 204 with or without a session', async () => {
    const database = await createMigratedDatabase(inject('databaseUrl'), 'logout');
    const api = await startApi(database.url);
    try {
      const { user, token } = await memberSession(database.url, api);
      // Control: the token works before the logout, so the 401 afterwards is about the revocation.
      expect((await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${token}` } })).status).toBe(200);

      const logout = await fetch(`${api.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { cookie: `am_session=${token}` },
      });

      expect(logout.status).toBe(204);
      // The browser is told to drop the cookie: same name, empty value and no lifetime (AUTH-12).
      const cleared = logout.headers.get('set-cookie')!;
      expect(cleared).toMatch(/^am_session=;/);
      expect(cleared).toContain('Max-Age=0');
      expect(cleared).toContain('Path=/');
      expect(cleared).toContain('HttpOnly');

      // The old cookie no longer resolves, and the row says why.
      const after = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${token}` } });
      expect(after.status).toBe(401);
      const [row] = await query<{ revoked_at: Date | null }>(
        database.url,
        'select revoked_at from identity.sessions where user_id = $1',
        [user.id],
      );
      expect(row!.revoked_at).not.toBeNull();

      // Without a session it is still a logout: 204, with the cookie removed.
      const anonymous = await fetch(`${api.baseUrl}/auth/logout`, { method: 'POST' });
      expect(anonymous.status).toBe(204);
      expect(anonymous.headers.get('set-cookie')).toMatch(/^am_session=;/);
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });
});
