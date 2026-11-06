import { join } from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { testClock, type TestClock } from '../../../../test/clock.js';
import { runMigrations } from '../../../infra/database/migrations.js';
import { createPool } from '../../../infra/database/pool.js';
import { hashToken } from '../domain/tokens.js';
import { SESSION_DURATION_MS } from '../domain/session-renewal.js';
import { sessions, users } from '../infra/schema.js';
import { SessionsRepository } from '../infra/sessions.repository.js';
import { SessionService } from './session.service.js';

const migrationsFolder = join(import.meta.dirname, '../../../../drizzle');

interface TestDatabase {
  db: NodePgDatabase;
  adminUrl: string;
  databaseName: string;
  close(): Promise<void>;
}

/** A database of its own, migrated: the service is exercised against the real schema, never a mock. */
async function createTestDatabase(): Promise<TestDatabase> {
  const url = new URL(inject('databaseUrl'));
  const databaseName = `sessions_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`create database ${databaseName}`);
  await admin.end();

  url.pathname = `/${databaseName}`;
  const href = url.href;
  await runMigrations({ databaseUrl: href, migrationsFolder });
  const pool = createPool(href);
  return {
    db: drizzle(pool),
    adminUrl: href,
    databaseName,
    close: async () => {
      await pool.end();
      const cleanupUrl = new URL(href);
      cleanupUrl.pathname = '/postgres';
      const cleanup = new pg.Client({ connectionString: cleanupUrl.href });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${databaseName} with (force)`);
      await cleanup.end();
    },
  };
}

describe('session service', () => {
  let database: TestDatabase;
  let clock: TestClock;
  let service: SessionService;
  let userId: string;

  beforeEach(async () => {
    database = await createTestDatabase();
    clock = testClock('2026-11-03T12:00:00.000Z');
    service = new SessionService(new SessionsRepository(database.db), clock);
    const [user] = await database.db
      .insert(users)
      .values({ email: 'ana@example.com', name: 'Ana', passwordHash: 'x', role: 'member' })
      .returning({ id: users.id });
    userId = user!.id;
  });

  afterEach(async () => {
    await database.close();
  });

  it('stores only the sha-256 of 32-byte session and invitation tokens', async () => {
    const { token, expiresAt } = await service.create(userId);

    const rows = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(expiresAt.toISOString()).toBe('2026-12-03T12:00:00.000Z');
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('resolves a live session to its user', async () => {
    const { token } = await service.create(userId);

    const resolved = await service.resolve(token);

    expect(resolved?.user).toEqual({ id: userId, email: 'ana@example.com', name: 'Ana', role: 'member' });
    // 30 days are left, so nothing is renewed and no cookie needs re-sending.
    expect(resolved?.renewedExpiresAt).toBeNull();
  });

  it('does not resolve an unknown token', async () => {
    await expect(service.resolve('never-issued-token')).resolves.toBeUndefined();
  });

  it('does not resolve an expired session', async () => {
    const { token, expiresAt } = await service.create(userId);

    clock.set(new Date(expiresAt.getTime() + 1));

    await expect(service.resolve(token)).resolves.toBeUndefined();
    // An expired session is not renewed into a valid one.
    const [row] = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(row!.expiresAt.toISOString()).toBe(expiresAt.toISOString());
  });

  it('does not resolve a revoked session', async () => {
    const { token } = await service.create(userId);

    await service.revoke(token);

    await expect(service.resolve(token)).resolves.toBeUndefined();
    const [row] = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(row!.revokedAt).not.toBeNull();
  });

  it('extends a session with less than 29 days left and re-sends the cookie', async () => {
    const { token } = await service.create(userId);
    // 28 days and change are left: below the threshold, so the next request extends it.
    await setExpiry(database, userId, new Date(clock.now().getTime() + 28 * 24 * 60 * 60 * 1000));

    const resolved = await service.resolve(token);

    expect(resolved?.renewedExpiresAt?.toISOString()).toBe('2026-12-03T12:00:00.000Z');
    const [row] = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(row!.expiresAt.toISOString()).toBe('2026-12-03T12:00:00.000Z');
  });

  it('leaves a session with 29 days or more alone', async () => {
    const { token } = await service.create(userId);
    const exactlyTwentyNine = new Date(clock.now().getTime() + 29 * 24 * 60 * 60 * 1000);
    await setExpiry(database, userId, exactlyTwentyNine);

    const resolved = await service.resolve(token);

    expect(resolved?.renewedExpiresAt).toBeNull();
    expect(resolved?.expiresAt.toISOString()).toBe(exactlyTwentyNine.toISOString());
    const [row] = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(row!.expiresAt.toISOString()).toBe(exactlyTwentyNine.toISOString());
  });

  it('deletes only the expired sessions of a user', async () => {
    const first = await service.create(userId);
    await service.create(userId);
    await setExpiry(database, userId, new Date(clock.now().getTime() - 1), first.token);
    // A session of somebody else is never touched.
    const [other] = await database.db
      .insert(users)
      .values({ email: 'bruno@example.com', name: 'Bruno', passwordHash: 'x', role: 'admin' })
      .returning({ id: users.id });
    await service.create(other!.id);

    await service.deleteExpiredOfUser(userId);

    const mine = await database.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.tokenHash).not.toBe(hashToken(first.token));
    expect(await database.db.select().from(sessions).where(eq(sessions.userId, other!.id))).toHaveLength(1);
  });

  it('revokes every session of a user and tolerates an unknown token', async () => {
    const first = await service.create(userId);
    const second = await service.create(userId);

    await service.revokeAllOfUser(userId);
    await expect(service.revoke('never-issued-token')).resolves.toBeUndefined();

    await expect(service.resolve(first.token)).resolves.toBeUndefined();
    await expect(service.resolve(second.token)).resolves.toBeUndefined();
  });
});

/** Moves a session's expiry directly in the database, the way a test ages a session without waiting. */
async function setExpiry(database: TestDatabase, userId: string, expiresAt: Date, token?: string): Promise<void> {
  const target = token === undefined ? eq(sessions.userId, userId) : eq(sessions.tokenHash, hashToken(token));
  await database.db.update(sessions).set({ expiresAt }).where(target);
}
