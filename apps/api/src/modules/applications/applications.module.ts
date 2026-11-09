import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/index.js';
import { ApplicationsService } from './application/applications.service.js';
import { ApplicationsController } from './http/applications.controller.js';
import { ApplicationsRepository } from './infra/applications.repository.js';

/** The member's job postings and applications: status, timeline and the skills a posting asks for. */
@Module({
  imports: [SkillsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsRepository, ApplicationsService],
})
export class ApplicationsModule {}
