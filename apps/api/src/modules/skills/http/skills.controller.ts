import type { SearchSkillsQuery, Skill } from '@am/contracts';
import { searchSkillsQuerySchema } from '@am/contracts';
import { Controller, Get, Query } from '@nestjs/common';
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
}
