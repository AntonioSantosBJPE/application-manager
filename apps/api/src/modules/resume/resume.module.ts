import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/index.js';
import { ResumeService } from './application/resume.service.js';
import { ResumeController } from './http/resume.controller.js';
import { ResumeRepository } from './infra/resume.repository.js';

/** The member's master resume: profile, experiences, projects, education, certifications, languages and bullets. */
@Module({
  imports: [SkillsModule],
  controllers: [ResumeController],
  providers: [ResumeRepository, ResumeService],
})
export class ResumeModule {}
