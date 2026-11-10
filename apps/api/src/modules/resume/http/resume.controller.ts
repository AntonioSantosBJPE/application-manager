import type { MasterResume } from '@am/contracts';
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../identity/index.js';
import { ResumeService } from '../application/resume.service.js';

/** What a member does with the master resume; the admin has no use for these routes (AD-005, RES-30). */
@Controller('resume')
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Roles('member')
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MasterResume> {
    return this.resume.get(user.id);
  }
}
