import { Module } from '@nestjs/common';
import { SkillsCatalog } from './application/skills-catalog.js';
import { SkillsAdminService } from './application/skills-admin.service.js';
import { SkillsService } from './application/skills.service.js';
import { SkillsAdminController } from './http/skills-admin.controller.js';
import { SkillsController } from './http/skills.controller.js';
import { SkillsRepository } from './infra/skills.repository.js';

/** The shared skills catalog: global skills, the privates of each person and their aliases. */
@Module({
  controllers: [SkillsController, SkillsAdminController],
  providers: [SkillsRepository, SkillsService, SkillsAdminService, SkillsCatalog],
  exports: [SkillsCatalog],
})
export class SkillsModule {}
