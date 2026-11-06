import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { Role } from '@am/contracts';
import { sessions, users } from '../infra/schema.js';

/**
 * The connection or transaction a write runs on: the login and the invitation acceptance create a
 * session inside their own transaction, so the row exists only if the whole operation does.
 */
export type DatabaseExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: SessionUser;
}

/** SQL for `identity.sessions`. The rule about when a session counts lives in the service (AD-006). */
@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** A session and its user by the hash of the token; a token that was never issued finds nothing. */
  async findByTokenHash(
    tokenHash: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<SessionRow | undefined> {
    const [row] = await executor
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    if (row === undefined) return undefined;
    const { email, name, role, ...session } = row;
    return { ...session, user: { id: row.userId, email, name, role } };
  }

  async insert(
    values: { userId: string; tokenHash: string; expiresAt: Date },
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    await executor.insert(sessions).values(values);
  }

  async extend(id: string, expiresAt: Date, executor: DatabaseExecutor = this.db): Promise<void> {
    await executor.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
  }

  /** Revokes the session of a token hash, if it is still active; answers whether a row changed. */
  async revokeByTokenHash(tokenHash: string, revokedAt: Date, executor: DatabaseExecutor = this.db): Promise<boolean> {
    const revoked = await executor
      .update(sessions)
      .set({ revokedAt })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return revoked.length > 0;
  }

  async revokeAllOfUser(userId: string, revokedAt: Date, executor: DatabaseExecutor = this.db): Promise<void> {
    await executor
      .update(sessions)
      .set({ revokedAt })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  /** A login drops the sessions of its user that already expired (AUTH-13), keeping the valid ones. */
  async deleteExpiredOfUser(userId: string, now: Date, executor: DatabaseExecutor = this.db): Promise<void> {
    await executor.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));
  }
}
