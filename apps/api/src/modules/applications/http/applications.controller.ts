import {
  createApplicationRequestSchema,
  listApplicationsQuerySchema,
  type ApplicationDetail,
  type ApplicationsPage,
  type CreateApplicationRequest,
  type InvalidSkillsProblem,
  type ListApplicationsQuery,
} from '@am/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../identity/index.js';
import { decodeCursor } from '../domain/cursor.js';
import { ApplicationNotFoundError, ApplicationsService, InvalidSkillsError } from '../application/applications.service.js';

/** The rule errors of the service as the Problem Details answers the spec fixes (APP-05). */
async function answering<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InvalidSkillsError) {
      const problem: InvalidSkillsProblem = { ...problemFor(422, error.message), invalidSkillIds: error.invalidSkillIds };
      throw new ProblemDetailsException(problem);
    }
    if (error instanceof ApplicationNotFoundError) throw new ProblemDetailsException(problemFor(404, error.message));
    throw error;
  }
}

/** What a member does with applications; the admin has no use for these routes (AD-005, APP-38). */
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Roles('member')
  @Post()
  create(
    @Body(zodBody(createApplicationRequestSchema)) body: CreateApplicationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationDetail> {
    return answering(() => this.applications.create(user.id, body));
  }

  @Roles('member')
  @Get()
  list(@Query(zodBody(listApplicationsQuerySchema)) query: ListApplicationsQuery, @CurrentUser() user: AuthenticatedUser): Promise<ApplicationsPage> {
    // A cursor that is not one of ours is a request the client got wrong (APP-17).
    if (query.cursor !== undefined && decodeCursor(query.cursor) === undefined) {
      throw new ProblemDetailsException(problemFor(400, 'Invalid cursor', [{ path: 'cursor', code: 'invalid_cursor' }]));
    }
    return this.applications.list(user.id, query);
  }

  @Roles('member')
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<ApplicationDetail> {
    return answering(() => this.applications.get(user.id, id));
  }
}
