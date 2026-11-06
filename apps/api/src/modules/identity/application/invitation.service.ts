import { Inject, Injectable } from '@nestjs/common';
import type { CreateInvitationResponse, InvitationDetails } from '@am/contracts';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import type { ApiEnv } from '../../../config/env.js';
import { generateToken, hashToken } from '../domain/tokens.js';
import { isPendingEmailConflict, InvitationsRepository } from '../infra/invitations.repository.js';
import { UsersRepository } from '../infra/users.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService, type CreatedSession } from './session.service.js';

/** An invitation lives 7 days (INV-01). */
export const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Settings the identity services read from the environment; injected so a test can replace the public URL. */
export const IDENTITY_ENV = Symbol('IDENTITY_ENV');

/** Where the invite page lives on the web app; the link is built from `WEB_PUBLIC_URL` (INV-01). */
const INVITE_PATH = '/invite';

/** What the answer carries: the link, which is shown once, and when it stops working (INV-01). */
export type CreateInvitationResult = CreateInvitationResponse;

/**
 * The invitation cannot be used: unknown, expired, already accepted or revoked. One error for the
 * four, because the answer and the screen are the same and the token has enough entropy to make
 * enumeration pointless (INV-06).
 */
export class InvitationNotUsableError extends Error {
  constructor() {
    super('Invitation is not usable');
    this.name = 'InvitationNotUsableError';
  }
}

export type AcceptInvitationResult = CreatedSession;

/**
 * Creating, reading and accepting invitations (INV-01..INV-10). The token exists only in the answer
 * of the creation: the database keeps its SHA-256, which is why the link is shown once and a lost one
 * is replaced, never reissued.
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly users: UsersRepository,
    private readonly sessions: SessionService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IDENTITY_ENV) private readonly env: Pick<ApiEnv, 'webPublicUrl'>,
  ) {}

  /** The new invitation, or `undefined` when the email already has an account (INV-03). */
  async create(email: string, invitedBy: string): Promise<CreateInvitationResult | undefined> {
    if ((await this.users.findByEmail(email)) !== undefined) return undefined;
    const created = await this.insertReplacingPending(email, invitedBy);
    if (created === undefined) return undefined;
    return {
      inviteUrl: `${this.env.webPublicUrl}${INVITE_PATH}/${created.token}`,
      expiresAt: created.expiresAt.toISOString(),
    };
  }

  /** What the invite page shows while the link is still good, or nothing when it is not (INV-05, INV-06). */
  async inspect(token: string): Promise<InvitationDetails | undefined> {
    const pending = await this.invitations.findPendingByTokenHash(hashToken(token), this.clock.now());
    if (pending === undefined) return undefined;
    return { email: pending.email, expiresAt: pending.expiresAt.toISOString() };
  }

  /**
   * Turns a pending invitation into a member account and a session, in one transaction (INV-07).
   *
   * The password hash is computed before the transaction opens: Argon2 is slow and holding a
   * transaction for it would serialize every acceptance behind one. Inside, the invitation is marked
   * accepted with a conditional `UPDATE` whose row lock serializes two simultaneous accepts, so the
   * second finds nothing and gets `410` (INV-09). The user is then inserted; if the email turned into
   * an account while the invitation was pending, the insert changes no row, the transaction rolls
   * back and the answer is the same `410` (EDGE-05).
   *
   * A session that accompanied the browser is revoked before the new one starts: a browser keeps one
   * session cookie (INV-10).
   */
  async accept(input: {
    token: string;
    name: string;
    password: string;
    currentSessionToken?: string;
  }): Promise<AcceptInvitationResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const tokenHash = hashToken(input.token);
    const now = this.clock.now();

    return this.invitations.transaction(async (tx) => {
      const email = await this.invitations.accept(tokenHash, now, tx);
      if (email === undefined) throw new InvitationNotUsableError();

      const user = await this.users.insertMember({ email, name: input.name, passwordHash }, tx);
      if (user === undefined) throw new InvitationNotUsableError();

      if (input.currentSessionToken !== undefined) await this.sessions.revoke(input.currentSessionToken, tx);
      return this.sessions.create(user.id, tx);
    });
  }

  /**
   * Revokes the pending invitation of the email and writes the new one in a single transaction, so
   * the replacement never leaves the email without a usable link (INV-04).
   *
   * Two admins inviting the same address at once both revoke, and both insert: the partial unique
   * index lets one through. The loser re-reads the account and retries once, which is enough to
   * settle a race this small.
   */
  private async insertReplacingPending(
    email: string,
    invitedBy: string,
    attempt = 0,
  ): Promise<{ id: string; expiresAt: Date; token: string } | undefined> {
    const token = generateToken();
    const expiresAt = new Date(this.clock.now().getTime() + INVITATION_DURATION_MS);
    try {
      const created = await this.invitations.transaction(async (tx) => {
        await this.invitations.revokePendingOfEmail(email, this.clock.now(), tx);
        return this.invitations.insert(
          { email, tokenHash: hashToken(token), invitedBy, expiresAt },
          tx,
        );
      });
      return { ...created, token };
    } catch (error) {
      if (!isPendingEmailConflict(error)) throw error;
      // Somebody invited the same address in between; if it became an account, that is the answer.
      if (attempt > 0 || (await this.users.findByEmail(email)) !== undefined) return undefined;
      return this.insertReplacingPending(email, invitedBy, attempt + 1);
    }
  }
}
