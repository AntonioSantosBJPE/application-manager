import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { CreateInvitationRequest, CreateInvitationResponse } from '@am/contracts';
import { createInvitationRequestSchema } from '@am/contracts';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { InvitationService } from '../application/invitation.service.js';
import { CurrentUser, Roles, type AuthenticatedUser } from './access.decorators.js';

/**
 * Invitations are the admin's tool: a member receives `403` from the guard and never reaches the
 * handler (INV-02). The invitation is always the session's admin, whatever the body says (AUTH-16).
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationService) {}

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
}
