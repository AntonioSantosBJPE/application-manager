import type { CreateSkillRequest, SearchSkillsQuery, Skill } from '@am/contracts';
import { createSkillRequestSchema, searchSkillsQuerySchema } from '@am/contracts';
import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../identity/index.js';
import { SkillsService } from '../application/skills.service.js';

/** What a member does with the catalog; the admin has no use for these routes (AD-005, SKL-23). */
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Roles('member')
  @Get()
  search(@Query(zodBody(searchSkillsQuerySchema)) query: SearchSkillsQuery, @CurrentUser() user: AuthenticatedUser): Promise<Skill[]> {
    return this.skills.search(user.id, query.q);
  }

  /** `201` for a new private skill and `200` for the skill the name already was. */
  @Roles('member')
  @Post()
  async create(
    @Body(zodBody(createSkillRequestSchema)) body: CreateSkillRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<Skill> {
    const { skill, created } = await this.skills.create(user.id, body);
    response.statusCode = created ? 201 : 200;
    return skill;
  }
}
