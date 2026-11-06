import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { DatabaseExecutor } from './sessions.repository.js';
import { invitations } from './schema.js';

export interface PendingInvitation {
  id: string;
  email: string;
  expiresAt: Date;
}

/** Postgres answers a violated unique index with this SQLSTATE; the caller decides whether to retry. */
const UNIQUE_VIOLATION = '23505';
export const PENDING_EMAIL_INDEX = 'invitations_pending_email_unique';

/** Whether the failure is the one unique index this module races on: one pending invitation per email (INV-04). */
export function isPendingEmailConflict(error: unknown): boolean {
  const cause = (error as { cause?: unknown }).cause;
  for (const candidate of [error, cause]) {
    const { code, constraint } = (candidate ?? {}) as { code?: string; constraint?: string };
    if (code === UNIQUE_VIOLATION && constraint === PENDING_EMAIL_INDEX) return true;
  }
  return false;
}

/**
 * SQL for `identity.invitations`. Whether an invitation is still usable, and what accepting it does,
 * is decided by the service; this class only reads and writes rows (AD-006).
 */
@Injectable()
export class InvitationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Revokes whatever is pending for the email, so the new link is the only one that works (INV-04). */
  async revokePendingOfEmail(email: string, revokedAt: Date, executor: DatabaseExecutor = this.db): Promise<void> {
    await executor
      .update(invitations)
      .set({ revokedAt })
      .where(and(eq(invitations.email, email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
  }

  async insert(
    values: { email: string; tokenHash: string; invitedBy: string; expiresAt: Date },
    executor: DatabaseExecutor = this.db,
  ): Promise<PendingInvitation> {
    const [row] = await executor
      .insert(invitations)
      .values(values)
      .returning({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt });
    return row!;
  }

  /** A transaction handle, so a write and its revocation are one step. */
  transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(run);
  }

  /** A still usable invitation by the hash of its token; expired, accepted and revoked ones find nothing. */
  async findPendingByTokenHash(
    tokenHash: string,
    now: Date,
    executor: DatabaseExecutor = this.db,
  ): Promise<PendingInvitation | undefined> {
    const [row] = await executor
      .select({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt })
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, now),
        ),
      )
      .limit(1);
    return row;
  }

  /**
   * Marks a pending invitation accepted and answers its email, or answers nothing when the row was
   * already taken. The row lock of the `UPDATE` serializes two accepts of the same token (INV-09).
   */
  async accept(tokenHash: string, acceptedAt: Date, executor: DatabaseExecutor = this.db): Promise<string | undefined> {
    const [row] = await executor
      .update(invitations)
      .set({ acceptedAt })
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, acceptedAt),
        ),
      )
      .returning({ email: invitations.email });
    return row?.email;
  }
}
