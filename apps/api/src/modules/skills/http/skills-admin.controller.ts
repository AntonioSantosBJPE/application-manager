import {
  adminSkillsQuerySchema,
  aliasRequestSchema,
  updateSkillRequestSchema,
  type AdminSkillsPage,
  type AdminSkillsQuery,
  type Alias,
  type AliasRequest,
  type Skill,
  type UpdateSkillRequest,
} from '@am/contracts';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { Roles } from '../../identity/index.js';
import {
  SkillConflictError,
  SkillNotFoundError,
  SkillNotGlobalError,
  SkillsAdminService,
} from '../application/skills-admin.service.js';
import { decodeCursor } from '../domain/cursor.js';

/** The rule errors of the service as the Problem Details answers the design fixes. */
async function answering<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SkillNotFoundError) throw new ProblemDetailsException(problemFor(404, error.message));
    if (error instanceof SkillConflictError) throw new ProblemDetailsException(problemFor(409, error.message));
    if (error instanceof SkillNotGlobalError) throw new ProblemDetailsException(problemFor(422, error.message));
    throw error;
  }
}

/** What the admin does with the catalog; a member has no use for these routes (AD-005, SKL-22). */
@Controller()
export class SkillsAdminController {
  constructor(private readonly admin: SkillsAdminService) {}

  /** The whole catalog, privates of every person included and with no owner anywhere (SKL-33..SKL-37). */
  @Roles('admin')
  @Get('admin/skills')
  list(@Query(zodBody(adminSkillsQuerySchema)) query: AdminSkillsQuery): Promise<AdminSkillsPage> {
    const { cursor: text, ...filters } = query;
    const cursor = text === undefined ? undefined : decodeCursor(text);
    if (text !== undefined && cursor === undefined) {
      throw new ProblemDetailsException(problemFor(400, 'Invalid cursor', [{ path: 'cursor', code: 'invalid_cursor' }]));
    }
    return this.admin.list({ ...filters, cursor });
  }

  /** A private skill becomes global with the same id; a global one stays as it is (SKL-17..SKL-21). */
  @Roles('admin')
  @Post('skills/:id/promote')
  @HttpCode(HttpStatus.OK)
  promote(@Param('id') id: string): Promise<Skill> {
    return answering(() => this.admin.promote(id));
  }

  /** `201` for a new alias and `200` for the one the skill already had (SKL-26..SKL-31). */
  @Roles('admin')
  @Post('skills/:id/aliases')
  async addAlias(
    @Param('id') id: string,
    @Body(zodBody(aliasRequestSchema)) body: AliasRequest,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<Alias> {
    const { alias, created } = await answering(() => this.admin.addAlias(id, body.alias));
    response.statusCode = created ? 201 : 200;
    return alias;
  }

  /** Name and category of a global skill; the id stays (SKL-62..SKL-66). */
  @Roles('admin')
  @Patch('skills/:id')
  update(@Param('id') id: string, @Body(zodBody(updateSkillRequestSchema)) body: UpdateSkillRequest): Promise<Skill> {
    return answering(() => this.admin.update(id, body));
  }

  @Roles('admin')
  @Patch('skills/:id/aliases/:aliasId')
  updateAlias(
    @Param('id') id: string,
    @Param('aliasId') aliasId: string,
    @Body(zodBody(aliasRequestSchema)) body: AliasRequest,
  ): Promise<Alias> {
    return answering(() => this.admin.updateAlias(id, aliasId, body.alias));
  }

  @Roles('admin')
  @Delete('skills/:id/aliases/:aliasId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAlias(@Param('id') id: string, @Param('aliasId') aliasId: string): Promise<void> {
    await answering(() => this.admin.removeAlias(id, aliasId));
  }
}
