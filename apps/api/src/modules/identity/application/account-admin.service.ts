import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@am/contracts';
import { normalizeEmail } from '../domain/credentials.js';
import { UsersRepository } from '../infra/users.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';

/** Why an account command refused to write anything: a different account already holds the email, or none does. */
export type AccountAdminRefusal = 'email-taken' | 'unknown-email';

export type AccountAdminResult =
  | { ok: true; user: { id: string; email: string; role: Role } }
  | { ok: false; reason: AccountAdminRefusal };

/**
 * The two account commands the CLI runs (CLI-01..CLI-05). They take the password already validated:
 * the rule is a length window, checked before the command touches the database, so a refusal leaves
 * every table as it was.
 *
 * Nothing here is reachable over HTTP: the admin exists only from the command line (CLI-07).
 */
@Injectable()
export class AccountAdminService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  /** Creates an admin, lowercasing the email; an email that already has any account is refused (CLI-01, CLI-02). */
  async createAdmin(input: { email: string; name: string; password: string }): Promise<AccountAdminResult> {
    // The hash is computed before the insert, so a unique violation cannot leave a half-written row.
    const passwordHash = await this.hasher.hash(input.password);
    const created = await this.users.insertAdmin({
      email: normalizeEmail(input.email),
      name: input.name,
      passwordHash,
    });
    if (created === undefined) return { ok: false, reason: 'email-taken' };
    return { ok: true, user: { id: created.id, email: normalizeEmail(input.email), role: 'admin' } };
  }

  /**
   * Replaces the password of an account of any role and revokes every session of it, so whoever was
   * already logged in has to present the new password (CLI-03).
   */
  async resetPassword(input: { email: string; password: string }): Promise<AccountAdminResult> {
    const user = await this.users.findByEmail(normalizeEmail(input.email));
    if (user === undefined) return { ok: false, reason: 'unknown-email' };

    const passwordHash = await this.hasher.hash(input.password);
    await this.users.updatePasswordHash(user.id, passwordHash);
    // Every session of the account ends: a reset is how a lost password is recovered from a stolen browser.
    await this.sessions.revokeAllOfUser(user.id);
    return { ok: true, user: { id: user.id, email: user.email, role: user.role } };
  }
}
