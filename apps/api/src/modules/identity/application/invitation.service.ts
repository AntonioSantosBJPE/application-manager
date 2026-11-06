import { Inject, Injectable } from '@nestjs/common';
import type { CreateInvitationResponse } from '@am/contracts';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import type { ApiEnv } from '../../../config/env.js';
import { generateToken, hashToken } from '../domain/tokens.js';
import { isPendingEmailConflict, InvitationsRepository } from '../infra/invitations.repository.js';
import { UsersRepository } from '../infra/users.repository.js';

/** An invitation lives 7 days (INV-01). */
export const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Settings the identity services read from the environment; injected so a test can replace the public URL. */
export const IDENTITY_ENV = Symbol('IDENTITY_ENV');

/** Where the invite page lives on the web app; the link is built from `WEB_PUBLIC_URL` (INV-01). */
const INVITE_PATH = '/invite';

/** What the answer carries: the link, which is shown once, and when it stops working (INV-01). */
export type CreateInvitationResult = CreateInvitationResponse;

/**
 * Creating an invitation (INV-01..INV-04). The token exists only in the answer: the database keeps
 * its SHA-256, which is why the link is shown once and a lost one is replaced, never reissued.
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly users: UsersRepository,
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
