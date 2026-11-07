import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher } from './password-hasher.js';
import { createPool } from '../../../infra/database/pool.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';
import { SessionService } from './session.service.js';
import { SessionsRepository } from '../infra/sessions.repository.js';
import { UsersRepository } from '../infra/users.repository.js';
import { AccountAdminService } from './account-admin.service.js';
import { testClock } from '../../../../test/clock.js';

const password = 'correct-horse-battery';
const newPassword = 'novo-cavalo-bateria';

type Database = Awaited<ReturnType<typeof createMigratedDatabase>>;

/** The service wired the way Nest wires it: real repositories, the real hasher, a clock under control. */
async function serviceFor(database: Database, sessionsRepository?: SessionsRepository) {
  const pool = createPool(database.url);
  const db: NodePgDatabase = drizzle(pool);
  const users = new UsersRepository(db);
  const sessions = new SessionService(
    sessionsRepository ?? new SessionsRepository(db),
    testClock('2026-11-03T12:00:00.000Z'),
  );
  return { service: new AccountAdminService(users, sessions, argon2idPasswordHasher), close: () => pool.end() };
}

/** A repository whose revocation always fails, to prove the update and the revocation are one step. */
async function failingRevocation(databaseUrl: string): Promise<{ repository: SessionsRepository; close: () => Promise<void> }> {
  const pool = createPool(databaseUrl);
  const repository = new SessionsRepository(drizzle(pool));
  repository.revokeAllOfUser = async () => {
    throw new Error('revocation failed on purpose');
  };
  return { repository, close: () => pool.end() };
}

async function usersOf(databaseUrl: string) {
  return query<{ id: string; email: string; name: string; role: string; password_hash: string }>(
    databaseUrl,
    'select id, email, name, role, password_hash from identity.users order by email',
  );
}

async function withDatabase(run: (database: Database) => Promise<void>) {
  const database = await createMigratedDatabase(inject('databaseUrl'), 'account_admin');
  try {
    await run(database);
  } finally {
    await dropDatabase(inject('databaseUrl'), database);
  }
}

describe('account administration', () => {
  it('createAdmin creates a lowercase admin', async () => {
    await withDatabase(async (database) => {
      const { service, close } = await serviceFor(database);
      try {
        const result = await service.createAdmin({
          email: '  Admin.Novo@Example.COM ',
          name: 'Admin Novo',
          password,
        });

        expect(result.ok).toBe(true);
        const [user] = await usersOf(database.url);
        // Stored lowercased without spaces, as an admin, with the password only as its PHC hash (CLI-01).
        expect(user!.email).toBe('admin.novo@example.com');
        expect(user!.role).toBe('admin');
        expect(user!.name).toBe('Admin Novo');
        expect(user!.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        await expect(argon2idPasswordHasher.verify(user!.password_hash, password)).resolves.toBe(true);
        expect(JSON.stringify(user)).not.toContain(password);
      } finally {
        await close();
      }
    });
  });

  it('createAdmin refuses an existing email in any role without touching users', async () => {
    await withDatabase(async (database) => {
      const { service, close } = await serviceFor(database);
      try {
        await service.createAdmin({ email: 'admin.a@example.com', name: 'Admin A', password });
        // A member account holds the second address: the refusal is about the email, not about the role (CLI-02).
        await query(
          database.url,
          "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member')",
          ['member.b@example.com', 'Member B', await argon2idPasswordHasher.hash(password)],
        );
        const before = await usersOf(database.url);

        const adminTaken = await service.createAdmin({ email: 'admin.a@example.com', name: 'Outro Nome', password: newPassword });
        const memberTaken = await service.createAdmin({ email: 'member.b@example.com', name: 'Outro Nome', password: newPassword });

        expect(adminTaken).toEqual({ ok: false, reason: 'email-taken' });
        expect(memberTaken).toEqual({ ok: false, reason: 'email-taken' });
        // Not one row changed: no name, no hash, no new account.
        expect(await usersOf(database.url)).toEqual(before);
      } finally {
        await close();
      }
    });
  });

  it('resetPassword changes the hash keeps the role and revokes every session', async () => {
    await withDatabase(async (database) => {
      const { service, close } = await serviceFor(database);
      try {
        // A member with two live sessions: both have to end with the reset (CLI-03).
        const [created] = await query<{ id: string }>(
          database.url,
          "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member') returning id",
          ['member.reset@example.com', 'Member Reset', await argon2idPasswordHasher.hash(password)],
        );
        await query(
          database.url,
          "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')",
          [created!.id, 'hash-one'],
        );
        await query(
          database.url,
          "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')",
          [created!.id, 'hash-two'],
        );
        const [before] = await usersOf(database.url);

        const result = await service.resetPassword({ email: ' Member.Reset@Example.com ', password: newPassword });

        expect(result).toEqual({ ok: true, user: { id: created!.id, email: 'member.reset@example.com', role: 'member' } });
        const [after] = await usersOf(database.url);
        // Same account, same role, new hash: the old password no longer verifies and the new one does.
        expect(after!.id).toBe(before!.id);
        expect(after!.role).toBe('member');
        expect(after!.name).toBe(before!.name);
        expect(after!.password_hash).not.toBe(before!.password_hash);
        await expect(argon2idPasswordHasher.verify(after!.password_hash, newPassword)).resolves.toBe(true);
        await expect(argon2idPasswordHasher.verify(after!.password_hash, password)).resolves.toBe(false);

        const sessions = await query<{ revoked_at: Date | null }>(
          database.url,
          'select revoked_at from identity.sessions where user_id = $1 order by token_hash',
          [created!.id],
        );
        expect(sessions).toHaveLength(2);
        expect(sessions.every((session) => session.revoked_at !== null)).toBe(true);
      } finally {
        await close();
      }
    });
  });

  it('resetPassword keeps the old hash when the revocation fails, in one transaction', async () => {
    await withDatabase(async (database) => {
      const [created] = await query<{ id: string }>(
        database.url,
        "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member') returning id",
        ['member.atomic@example.com', 'Member Atomic', await argon2idPasswordHasher.hash(password)],
      );
      await query(
        database.url,
        "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')",
        [created!.id, 'hash-atomic'],
      );
      const [before] = await usersOf(database.url);

      // The revocation is the second half of the reset; a failure there must undo the new hash too,
      // or the account would answer the old password while the operator believes it changed (CLI-03).
      const failing = await failingRevocation(database.url);
      const { service, close } = await serviceFor(database, failing.repository);
      try {
        await expect(service.resetPassword({ email: 'member.atomic@example.com', password: newPassword })).rejects.toThrow(
          'revocation failed on purpose',
        );
      } finally {
        await close();
        await failing.close();
      }

      const [after] = await usersOf(database.url);
      // The stored hash is still the old one, so the reset left the account exactly as it was.
      expect(after!.password_hash).toBe(before!.password_hash);
      await expect(argon2idPasswordHasher.verify(after!.password_hash, password)).resolves.toBe(true);
      await expect(argon2idPasswordHasher.verify(after!.password_hash, newPassword)).resolves.toBe(false);
      // And the session that was not revoked is still active, so nothing half-happened.
      const [session] = await query<{ revoked_at: Date | null }>(
        database.url,
        'select revoked_at from identity.sessions where user_id = $1',
        [created!.id],
      );
      expect(session!.revoked_at).toBeNull();
    });
  });

  it('resetPassword refuses an unknown email without creating a user', async () => {
    await withDatabase(async (database) => {
      const { service, close } = await serviceFor(database);
      try {
        const result = await service.resetPassword({ email: 'ninguem@example.com', password: newPassword });

        expect(result).toEqual({ ok: false, reason: 'unknown-email' });
        expect(await usersOf(database.url)).toEqual([]);
      } finally {
        await close();
      }
    });
  });

  it('resetPassword keeps a member a member', async () => {
    await withDatabase(async (database) => {
      const { service, close } = await serviceFor(database);
      try {
        // The reset is for an account of any role and never changes it: a member stays a member (CLI-03).
        await query(
          database.url,
          "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member')",
          ['member.role@example.com', 'Member Role', await argon2idPasswordHasher.hash(password)],
        );

        const result = await service.resetPassword({ email: 'member.role@example.com', password: newPassword });

        expect(result.ok && result.user.role).toBe('member');
        expect((await usersOf(database.url)).map((user) => user.role)).toEqual(['member']);
      } finally {
        await close();
      }
    });
  });
});
