import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { generateToken, hashToken } from '../domain/tokens.js';
import { renewedExpiry, SESSION_DURATION_MS } from '../domain/session-renewal.js';
import {
  SessionsRepository,
  type DatabaseExecutor,
  type SessionUser,
} from '../infra/sessions.repository.js';

/** A session that resolves: who it belongs to, and the new expiry when it was just extended. */
export interface ResolvedSession {
  user: SessionUser;
  expiresAt: Date;
  /** Set when the session was extended; the caller re-sends the cookie with the same token (AUTH-11). */
  renewedExpiresAt: Date | null;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/**
 * Creating, resolving, extending and revoking sessions (AUTH-06, AUTH-10, AUTH-11). The database is
 * read on every request: revocation takes effect on the next one, with no cache to invalidate.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The session of an opaque token, or `undefined` when it is unknown, expired or revoked (AUTH-10).
   * A session with less than 29 days left is extended to 30 days from now (AUTH-11).
   */
  async resolve(token: string, executor?: DatabaseExecutor): Promise<ResolvedSession | undefined> {
    const now = this.clock.now();
    const session = await this.sessions.findByTokenHash(hashToken(token), executor);
    if (session === undefined || session.revokedAt !== null) return undefined;
    if (session.expiresAt.getTime() <= now.getTime()) return undefined;

    const renewed = renewedExpiry(session.expiresAt, now);
    if (renewed !== null) await this.sessions.extend(session.id, renewed, executor);
    return { user: session.user, expiresAt: renewed ?? session.expiresAt, renewedExpiresAt: renewed };
  }

  /** Starts a session for a user: the token goes to the browser, only its SHA-256 to the database (AUTH-06). */
  async create(userId: string, executor?: DatabaseExecutor): Promise<CreatedSession> {
    const token = generateToken();
    const expiresAt = new Date(this.clock.now().getTime() + SESSION_DURATION_MS);
    await this.sessions.insert({ userId, tokenHash: hashToken(token), expiresAt }, executor);
    return { token, expiresAt };
  }

  /** Revokes the session of a token, if it is still active; an unknown token is not an error (AUTH-12). */
  async revoke(token: string, executor?: DatabaseExecutor): Promise<void> {
    await this.sessions.revokeByTokenHash(hashToken(token), this.clock.now(), executor);
  }

  async revokeAllOfUser(userId: string, executor?: DatabaseExecutor): Promise<void> {
    await this.sessions.revokeAllOfUser(userId, this.clock.now(), executor);
  }

  /** A login drops the sessions of the user that already expired, keeping the valid ones (AUTH-13). */
  async deleteExpiredOfUser(userId: string, executor?: DatabaseExecutor): Promise<void> {
    await this.sessions.deleteExpiredOfUser(userId, this.clock.now(), executor);
  }
}
