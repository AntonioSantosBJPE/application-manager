import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  CreateInvitationResponse,
  InvitationDetails,
} from '@am/contracts';
import { acceptInvitationRequestSchema, createInvitationRequestSchema } from '@am/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { InvitationNotUsableError, InvitationService } from '../application/invitation.service.js';
import { CurrentUser, Public, Roles, type AuthenticatedUser } from './access.decorators.js';
import {
  SESSION_COOKIE_OPTIONS,
  readSessionToken,
  setSessionCookie,
  type SessionCookieOptions,
} from './session-cookie.js';

/**
 * The invitation endpoints. Creation belongs to the admin (INV-02); opening and accepting a link are
 * public, because the person accepting has no session yet (INV-05, INV-07).
 */
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationService,
    @Inject(SESSION_COOKIE_OPTIONS) private readonly cookie: SessionCookieOptions,
  ) {}

  @Roles('admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(zodBody(createInvitationRequestSchema)) body: CreateInvitationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateInvitationResponse> {
    // `invited_by` comes from the session: a client cannot invite on somebody else's behalf (AUTH-16).
    const created = await this.invitations.create(body.email, user.id);
    // The address already has an account, so the invitation would have no one to open it (INV-03).
    if (created === undefined) throw new ProblemDetailsException(problemFor(409, 'Email already registered'));
    return created;
  }

  /** What the invite page shows while the link is good; an unusable token answers `410` (INV-05, INV-06). */
  @Public()
  @Get(':token')
  async inspect(@Param('token') token: string): Promise<InvitationDetails> {
    const details = await this.invitations.inspect(token);
    if (details === undefined) throw notUsable();
    return details;
  }

  /**
   * Creates the member account from the invitation and starts its session (INV-07). A session that
   * already accompanied the browser is revoked inside the same transaction (INV-10).
   *
   * The body is validated by the pipe before anything is written, so a name or password outside the
   * rule answers `400` and leaves the invitation pending (INV-08).
   */
  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.CREATED)
  async accept(
    @Param('token') token: string,
    @Body(zodBody(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<void> {
    let session;
    try {
      session = await this.invitations.accept({
        token,
        name: body.name,
        password: body.password,
        currentSessionToken: readSessionToken(request, this.cookie),
      });
    } catch (error) {
      if (error instanceof InvitationNotUsableError) throw notUsable();
      throw error;
    }
    setSessionCookie(response, session.token, this.cookie);
  }
}

/** One answer for an unknown, expired, accepted or revoked token: the screen is the same (INV-06). */
function notUsable(): ProblemDetailsException {
  return new ProblemDetailsException(problemFor(410, 'Invitation is not usable'));
}
