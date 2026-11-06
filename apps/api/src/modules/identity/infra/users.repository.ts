import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Role } from '@am/contracts';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import { users } from './schema.js';
import type { DatabaseExecutor } from './sessions.repository.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

/** SQL for `identity.users`. Whether a password matches and which entrance it opens is not decided here. */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** A user by the email it is stored under; the caller normalizes it first (EDGE-01). */
  async findByEmail(email: string, executor: DatabaseExecutor = this.db): Promise<UserRow | undefined> {
    const [row] = await executor
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row;
  }

  /**
   * A member account for an accepted invitation, or nothing when the email is already taken. The
   * unique index decides, so a user created between the invitation and its acceptance is never
   * overwritten (EDGE-05).
   */
  async insertMember(
    values: { email: string; name: string; passwordHash: string },
    executor: DatabaseExecutor = this.db,
  ): Promise<{ id: string } | undefined> {
    const [row] = await executor
      .insert(users)
      .values({ ...values, role: 'member' })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    return row;
  }

  /**
   * An admin account, or nothing when the email already belongs to somebody. The CLI is the only
   * caller: no route creates an admin (CLI-01, CLI-02, CLI-07).
   */
  async insertAdmin(values: { email: string; name: string; passwordHash: string }): Promise<{ id: string } | undefined> {
    const [row] = await this.db
      .insert(users)
      .values({ ...values, role: 'admin' })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    return row;
  }

  /** Replaces the stored hash, keeping the role: a reset never changes who somebody is (CLI-03). */
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }
}
