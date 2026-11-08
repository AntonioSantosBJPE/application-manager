import { adminSkillsQuerySchema, type AdminSkillsPage, type AdminSkillsQuery } from '@am/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ProblemDetailsException, problemFor } from '../../../infra/http/problem-details.js';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
import { Roles } from '../../identity/index.js';
import { SkillsAdminService } from '../application/skills-admin.service.js';
import { decodeCursor } from '../domain/cursor.js';

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
}
