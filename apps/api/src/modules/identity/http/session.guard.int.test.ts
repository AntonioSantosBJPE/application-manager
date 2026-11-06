import { Controller, Get, Module, Post, type INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../../app.module.js';
import { runMigrations } from '../../../infra/database/migrations.js';
import { createApp } from '../../../create-app.js';
import { testClock, type TestClock } from '../../../../test/clock.js';
import { SessionService } from '../application/session.service.js';
import { AnySession, CurrentUser, Public, Roles, type AuthenticatedUser } from './access.decorators.js';
import { SESSION_COOKIE_MAX_AGE_SECONDS } from './session-cookie.js';

/** Fixtures: one route per declaration, so the guard is proven through the real HTTP pipeline. */
@Controller('probe')
class ProbeController {
  @Get('closed')
  closed(@CurrentUser() user: AuthenticatedUser) {
    return { email: user.email };
  }

  @Public()
  @Get('public')
  open() {
    return { public: true };
  }

  @AnySession()
  @Get('any')
  any(@CurrentUser() user: AuthenticatedUser) {
    return { role: user.role };
  }

  @Roles('admin')
  @Post('admin')
  admin() {
    return { ok: true };
  }

  @Roles('member')
  @Post('member')
  member() {
    return { ok: true };
  }
}

const env = {
  webPublicUrl: 'http://localhost:3000',
  port: 0,
  logLevel: 'info' as const,
};

const migrationsFolder = join(import.meta.dirname, '../../../../drizzle');

/** A database of its own, migrated once, so the guard meets the real schema and never a mock. */
async function createMigratedDatabase(): Promise<{ url: string; name: string }> {
  const admin = new URL(inject('databaseUrl'));
  const name = `guard_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const client = new pg.Client({ connectionString: admin.href });
  await client.connect();
  await client.query(`create database ${name}`);
  await client.end();
  admin.pathname = `/${name}`;
  await runMigrations({ databaseUrl: admin.href, migrationsFolder });
  return { url: admin.href, name };
}

let database: { url: string; name: string };

beforeAll(async () => {
  database = await createMigratedDatabase();
}, 60_000);

afterAll(async () => {
  const admin = new URL(inject('databaseUrl'));
  const client = new pg.Client({ connectionString: admin.href });
  await client.connect();
  await client.query(`drop database if exists ${database.name} with (force)`);
  await client.end();
});

interface Api {
  app: INestApplication;
  baseUrl: string;
  clock: TestClock;
  sessions: SessionService;
  close(): Promise<void>;
}

/** The real AppModule plus the probe controllers, against the test database and a movable clock. */
async function startProbe(databaseUrl: string, options: { secure?: boolean } = {}): Promise<Api> {
  const clock = testClock('2026-11-03T12:00:00.000Z');
  @Module({
    imports: [
      AppModule.forRoot(
        { ...env, databaseUrl, sessionCookieSecure: options.secure ?? false },
        { logDestination: { write: () => true } as never, clock },
      ),
    ],
    controllers: [ProbeController],
  })
  class ProbeModule {}
  const app = await createApp(ProbeModule);
  await app.listen(0, '127.0.0.1');
  return {
    app,
    baseUrl: await app.getUrl(),
    clock,
    sessions: app.get(SessionService),
    close: () => app.close(),
  };
}

/** A user written straight to the table: the user repository arrives with the login endpoints. */
async function createUser(databaseUrl: string, role: 'admin' | 'member'): Promise<string> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const email = `${role}-${Math.random().toString(36).slice(2, 10)}@example.com`;
    const result = await client.query<{ id: string }>(
      "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id",
      [email, role === 'admin' ? 'Admin' : 'Ana', 'x', role],
    );
    return result.rows[0]!.id;
  } finally {
    await client.end();
  }
}

async function setExpiry(databaseUrl: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('update identity.sessions set expires_at = $1 where token_hash = $2', [expiresAt, tokenHash]);
  } finally {
    await client.end();
  }
}

const cookieHeader = (token: string) => ({ cookie: `am_session=${token}` });

describe('session guard', () => {
  it('answers 401 for a missing expired revoked and unknown session', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url);
    const userId = await createUser(databaseUrl, 'member');
    const live = await api.sessions.create(userId);
    try {
      // Control: the same route answers with a live session, so the 401s are about the session.
      expect((await fetch(`${api.baseUrl}/probe/closed`, { headers: cookieHeader(live.token) })).status).toBe(200);

      const expired = await api.sessions.create(userId);
      await setExpiry(databaseUrl, hashOf(expired.token), new Date(api.clock.now().getTime() - 1000));

      const revoked = await api.sessions.create(userId);
      await api.sessions.revoke(revoked.token);

      const attempts = [
        { name: 'missing', headers: {} },
        { name: 'expired', headers: cookieHeader(expired.token) },
        { name: 'revoked', headers: cookieHeader(revoked.token) },
        { name: 'unknown', headers: cookieHeader('never-issued-token') },
      ];
      for (const attempt of attempts) {
        const response = await fetch(`${api.baseUrl}/probe/closed`, { headers: attempt.headers });
        expect({ name: attempt.name, status: response.status }).toEqual({ name: attempt.name, status: 401 });
        expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }
    } finally {
      await api.close();
    }
  });

  it('extends the session and resends the cookie only below 29 days', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url);
    const userId = await createUser(databaseUrl, 'member');
    try {
      const soon = await api.sessions.create(userId);
      // 28 days and change are left: below the threshold, so the answer carries a fresh cookie.
      await setExpiry(databaseUrl, hashOf(soon.token), new Date(api.clock.now().getTime() + 28 * 86_400_000));

      const renewed = await fetch(`${api.baseUrl}/probe/closed`, { headers: cookieHeader(soon.token) });
      expect(renewed.status).toBe(200);
      const cookie = renewed.headers.get('set-cookie');
      expect(cookie).toContain(`am_session=${soon.token}`);
      expect(cookie).toContain('Max-Age=2592000');

      const [row] = await sessionRow(databaseUrl, soon.token);
      expect(row!.expires_at.toISOString()).toBe('2026-12-03T12:00:00.000Z');

      // A session with 29 days or more is left alone: no cookie comes back.
      const fresh = await api.sessions.create(userId);
      const untouched = await fetch(`${api.baseUrl}/probe/closed`, { headers: cookieHeader(fresh.token) });
      expect(untouched.status).toBe(200);
      expect(untouched.headers.get('set-cookie')).toBeNull();

      const [freshRow] = await sessionRow(databaseUrl, fresh.token);
      expect(freshRow!.expires_at.toISOString()).toBe('2026-12-03T12:00:00.000Z');
    } finally {
      await api.close();
    }
  });

  it('answers 403 when the role differs in both directions', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url);
    try {
      const admin = await api.sessions.create(await createUser(databaseUrl, 'admin'));
      const member = await api.sessions.create(await createUser(databaseUrl, 'member'));

      const memberOnAdmin = await fetch(`${api.baseUrl}/probe/admin`, { method: 'POST', headers: cookieHeader(member.token) });
      const adminOnMember = await fetch(`${api.baseUrl}/probe/member`, { method: 'POST', headers: cookieHeader(admin.token) });

      expect(memberOnAdmin.status).toBe(403);
      expect(adminOnMember.status).toBe(403);
      expect(memberOnAdmin.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');

      // Control: each role reaches its own route, so the 403s are about the role and not the route.
      expect((await fetch(`${api.baseUrl}/probe/admin`, { method: 'POST', headers: cookieHeader(admin.token) })).status).toBe(201);
      expect((await fetch(`${api.baseUrl}/probe/member`, { method: 'POST', headers: cookieHeader(member.token) })).status).toBe(201);
    } finally {
      await api.close();
    }
  });

  it('requires a session unless public and keeps /health public', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url);
    const member = await api.sessions.create(await createUser(databaseUrl, 'member'));
    try {
      // A route without a declaration is closed: the default is a session.
      expect((await fetch(`${api.baseUrl}/probe/closed`)).status).toBe(401);
      // A public route needs nothing, and a route declared for any session needs one.
      expect((await fetch(`${api.baseUrl}/probe/public`)).status).toBe(200);
      expect((await fetch(`${api.baseUrl}/probe/any`)).status).toBe(401);
      expect((await fetch(`${api.baseUrl}/probe/any`, { headers: cookieHeader(member.token) })).status).toBe(200);

      const health = await fetch(`${api.baseUrl}/health`);
      expect(health.status).toBe(200);
      expect(await health.text()).toBe('{"status":"ok","db":"up"}');
    } finally {
      await api.close();
    }
  });
});

describe('session cookie', () => {
  it('carries HttpOnly SameSite=Lax Path=/ Max-Age=2592000 and no Domain', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url);
    const userId = await createUser(databaseUrl, 'member');
    try {
      const soon = await api.sessions.create(userId);
      await setExpiry(databaseUrl, hashOf(soon.token), new Date(api.clock.now().getTime() + 86_400_000));

      const cookie = (await fetch(`${api.baseUrl}/probe/closed`, { headers: cookieHeader(soon.token) })).headers.get('set-cookie')!;

      expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(2592000);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).not.toContain('Domain');
    } finally {
      await api.close();
    }
  });

  it('is named __Host-am_session with Secure by default', async () => {
    const databaseUrl = database.url;
    const api = await startProbe(database.url, { secure: true });
    const userId = await createUser(databaseUrl, 'member');
    try {
      const soon = await api.sessions.create(userId);
      await setExpiry(databaseUrl, hashOf(soon.token), new Date(api.clock.now().getTime() + 86_400_000));

      // The browser sends the name the environment uses, so the fixture reads both.
      const response = await fetch(`${api.baseUrl}/probe/closed`, {
        headers: { cookie: `__Host-am_session=${soon.token}` },
      });
      const cookie = response.headers.get('set-cookie')!;

      expect(response.status).toBe(200);
      expect(cookie).toMatch(/^__Host-am_session=/);
      expect(cookie).toContain('Secure');
    } finally {
      await api.close();
    }
  });
});

function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function sessionRow(databaseUrl: string, token: string): Promise<{ expires_at: Date }[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (
      await client.query<{ expires_at: Date }>('select expires_at from identity.sessions where token_hash = $1', [
        hashOf(token),
      ])
    ).rows;
  } finally {
    await client.end();
  }
}
