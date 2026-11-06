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
}
