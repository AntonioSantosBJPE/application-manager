import { Module } from '@nestjs/common';
import { SkillsService } from './application/skills.service.js';
import { SkillsController } from './http/skills.controller.js';
import { SkillsRepository } from './infra/skills.repository.js';

/** The shared skills catalog: global skills, the privates of each person and their aliases. */
@Module({
  controllers: [SkillsController],
  providers: [SkillsRepository, SkillsService],
})
export class SkillsModule {}
