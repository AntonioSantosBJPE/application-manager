import { saveProfileRequestSchema, type MasterResume, type Profile, type ResumeSummary, type SaveProfileRequest } from '@am/contracts';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { zodBody } from '../../../infra/http/zod-body.pipe.js';
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

  /** Declared with the other fixed paths, before any route that takes a `:section` segment. */
  @Roles('member')
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ResumeSummary> {
    return this.resume.summary(user.id);
  }

  @Roles('member')
  @Put('profile')
  saveProfile(@Body(zodBody(saveProfileRequestSchema)) body: SaveProfileRequest, @CurrentUser() user: AuthenticatedUser): Promise<Profile> {
    return this.resume.saveProfile(user.id, body);
  }
}
