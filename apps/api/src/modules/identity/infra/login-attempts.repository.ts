import { Inject, Injectable } from '@nestjs/common';
import { and, eq, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import { evaluateLockout, LOCKOUT_WINDOW_MS, type LockoutVerdict } from '../domain/lockout.js';
import { loginAttempts } from './schema.js';

/** A failure of this email + IP, oldest first, as both windows count it. */
export interface LoginAttemptRow {
  email: string;
  pairCleared: boolean;
  attemptedAt: Date;
}

export type Reservation = { allowed: true; attemptId: string } | Extract<LockoutVerdict, { allowed: false }>;

/**
 * The stored side of the lockout (LOCK-01..LOCK-07). The rule about which counts block lives in
 * `domain/lockout.ts`; this class only reads the window, inserts the reservation and clears it.
 */
@Injectable()
export class LoginAttemptsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Decides whether an attempt may proceed and, when it may, records it as a reservation before any
   * password work happens.
   *
   * The read and the insert share one transaction under an advisory lock of the IP, so a burst of
   * simultaneous attempts is serialized here: the sixth sees five reservations and is refused, and
   * only five ever reach Argon2 (LOCK-01, LOCK-02, LOCK-05). Rows past the window are dropped on the
   * way (LOCK-07).
   */
  async reserveFailure(input: { email: string; ip: string; now: Date }): Promise<Reservation> {
    const windowStart = new Date(input.now.getTime() - LOCKOUT_WINDOW_MS);
    return this.db.transaction(async (tx) => {
      // One lock per IP: the same key for every attempt of the address, released with the transaction.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.ip}))`);

      await tx.delete(loginAttempts).where(lte(loginAttempts.attemptedAt, windowStart));

      const rows = await tx
        .select({
          email: loginAttempts.email,
          pairCleared: loginAttempts.pairCleared,
          attemptedAt: loginAttempts.attemptedAt,
        })
        .from(loginAttempts)
        .where(eq(loginAttempts.ip, input.ip));
      const counted: LoginAttemptRow[] = rows;
      const verdict = evaluateLockout(
        {
          // A success already cleared these for the pair, but they still count for the IP (LOCK-06).
          pairFailures: counted
            .filter((row) => row.email === input.email && !row.pairCleared)
            .map((row) => row.attemptedAt),
          ipFailures: counted.map((row) => row.attemptedAt),
        },
        input.now,
      );
      if (!verdict.allowed) return verdict;

      const [inserted] = await tx
        .insert(loginAttempts)
        .values({ email: input.email, ip: input.ip, attemptedAt: input.now })
        .returning({ id: loginAttempts.id });
      return { allowed: true as const, attemptId: inserted!.id };
    });
  }

  /**
   * A valid credential: the reservation it made is dropped and the pair's earlier failures stop
   * counting for the pair, while still counting for the IP (LOCK-06).
   */
  async recordSuccess(input: { attemptId: string; email: string; ip: string }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(loginAttempts).where(eq(loginAttempts.id, input.attemptId));
      await tx
        .update(loginAttempts)
        .set({ pairCleared: true })
        .where(
          and(
            eq(loginAttempts.email, input.email),
            eq(loginAttempts.ip, input.ip),
            eq(loginAttempts.pairCleared, false),
          ),
        );
    });
  }
}
