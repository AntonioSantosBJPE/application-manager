import { describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
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

/**
 * The logout journey for one cookie mode: the address signs in through the real endpoint, then asks
 * to be logged out with the cookie the answer set. `cookie` is what the mode names the cookie, which
 * is the plain name over http and `__Host-` under `Secure` (AUTH-08).
 */
async function logoutJourney(databaseUrl: string, options: { secure: boolean; email: string }) {
  const api = await startApi(databaseUrl, { sessionCookieSecure: options.secure });
  const cookieName = options.secure ? '__Host-am_session' : 'am_session';
  try {
    const [user] = await query<{ id: string; email: string }>(
      databaseUrl,
      `insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member')
         returning id, email`,
      [options.email, 'Ana Souza', await argon2idPasswordHasher.hash(password)],
    );
    const login = await fetch(`${api.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user!.email, password }),
    });
    expect(login.status).toBe(204);
    const issued = login.headers.get('set-cookie')!;
    const token = new RegExp(`^${cookieName}=([^;]+);`).exec(issued)?.[1] ?? '';
    expect(token).not.toBe('');
    expect(await query(databaseUrl, 'select token_hash from identity.sessions where user_id = $1', [user!.id])).toEqual([
      { token_hash: hashToken(token) },
    ]);

    // Control: the token works before the logout, so the 401 afterwards is about the revocation.
    expect((await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `${cookieName}=${token}` } })).status).toBe(200);

    const logout = await fetch(`${api.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { cookie: `${cookieName}=${token}` },
    });

    expect(logout.status).toBe(204);
    const cleared = logout.headers.get('set-cookie')!;

    // The old cookie no longer resolves, and the row says why.
    const after = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `${cookieName}=${token}` } });
    expect(after.status).toBe(401);
    const [row] = await query<{ revoked_at: Date | null }>(
      databaseUrl,
      'select revoked_at from identity.sessions where user_id = $1',
      [user!.id],
    );
    expect(row!.revoked_at).not.toBeNull();

    // Without a session it is still a logout: 204, with the cookie removed.
    const anonymous = await fetch(`${api.baseUrl}/auth/logout`, { method: 'POST' });
    expect(anonymous.status).toBe(204);

    return { issued, cleared, anonymousCleared: anonymous.headers.get('set-cookie')!, cookieName };
  } finally {
    await api.close();
  }
}

describe('POST /auth/logout', () => {
  it('revokes the session clears the cookie and answers 204 with or without a session', async () => {
    const database = await createMigratedDatabase(inject('databaseUrl'), 'logout');
    try {
      // Over http, the plain name without `Secure`: the mode a local API runs in.
      const plain = await logoutJourney(database.url, { secure: false, email: 'ana.me@example.com' });
      expect(plain.issued).toMatch(/^am_session=[^;]+;/);
      expect(plain.issued).not.toContain('Secure');
      expect(plain.cleared).toMatch(/^am_session=;/);
      expect(plain.cleared).toContain('Max-Age=0');
      expect(plain.cleared).toContain('Path=/');
      expect(plain.cleared).toContain('HttpOnly');
      expect(plain.anonymousCleared).toMatch(/^am_session=;/);

      // Under `SESSION_COOKIE_SECURE` the `__Host-` prefix only validates with `Secure`, `Path=/` and
      // no `Domain`, on the cookie the login sets and on the one the logout clears: a `__Host-` cookie
      // cleared without `Secure` is ignored by the browser, and "Sair" would leave the session behind.
      const secure = await logoutJourney(database.url, { secure: true, email: 'ana.secure@example.com' });
      for (const cookie of [secure.issued, secure.cleared, secure.anonymousCleared]) {
        expect(cookie).toMatch(/^__Host-am_session=/);
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('Path=/');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).not.toContain('Domain');
      }
      // The login keeps the lifetime of a session, and the clearing cookie drops it.
      expect(secure.issued).toContain('Max-Age=2592000');
      expect(secure.cleared).toMatch(/^__Host-am_session=;/);
      expect(secure.cleared).toContain('Max-Age=0');
      expect(secure.anonymousCleared).toMatch(/^__Host-am_session=;/);
      expect(secure.anonymousCleared).toContain('Max-Age=0');
    } finally {
      await dropDatabase(inject('databaseUrl'), database);
    }
  });
});
