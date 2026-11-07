import { sql } from 'drizzle-orm';
import { boolean, index, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * The `identity` module owns its own schema: no foreign key leaves it, so the module can be
 * extracted without a rewrite (EDGE-07).
 */
export const identity = pgSchema('identity');

export const userRole = identity.enum('user_role', ['admin', 'member']);

/** Keys default to `uuidv7()` in Postgres: time ordered, so the index stays compact (EDGE-07). */
const id = () => uuid().primaryKey().default(sql`uuidv7()`);

export const users = identity.table('users', {
  id: id(),
  /** Lowercased without surrounding spaces before it is written (EDGE-01). */
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRole().notNull(),
});

export const sessions = identity.table(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque token, in hex; the token itself is never stored (AUTH-06). */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    // A login deletes the expired sessions of its user (AUTH-13).
    index('sessions_user_id_expires_at_index').on(table.userId, table.expiresAt),
  ],
);

export const invitations = identity.table(
  'invitations',
  {
    id: id(),
    email: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    // At most one pending invitation per email: a new one revokes the previous (INV-04).
    uniqueIndex('invitations_pending_email_unique')
      .on(table.email)
      .where(sql`accepted_at is null and revoked_at is null`),
    index('invitations_pending_expires_at_index')
      .on(table.expiresAt)
      .where(sql`accepted_at is null and revoked_at is null`),
  ],
);

/** A failed login, kept only for the 15 minute window of the lockout (LOCK-01..LOCK-07). */
export const loginAttempts = identity.table(
  'login_attempts',
  {
    id: id(),
    email: text().notNull(),
    ip: text().notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
    /** A success marks the pair's failures so they stop counting for the pair, still counting for the IP (LOCK-06). */
    pairCleared: boolean('pair_cleared').notNull().default(false),
  },
  (table) => [
    index('login_attempts_ip_attempted_at_index').on(table.ip, table.attemptedAt),
    index('login_attempts_email_ip_attempted_at_index').on(table.email, table.ip, table.attemptedAt),
  ],
);
