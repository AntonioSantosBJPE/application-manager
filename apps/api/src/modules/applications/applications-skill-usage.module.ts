import { Global, Module } from '@nestjs/common';
import { SKILL_USAGE } from '../skills/index.js';
import { ApplicationsSkillUsage } from './application/applications-skill-usage.js';

/**
 * Registers the count of postings per skill for the admin catalog. It is global and does not import
 * `SkillsModule`, so the two modules form no cycle, in Nest or in imports (AD-019).
 */
@Global()
@Module({
  providers: [ApplicationsSkillUsage, { provide: SKILL_USAGE, useExisting: ApplicationsSkillUsage }],
  exports: [SKILL_USAGE],
})
export class ApplicationsSkillUsageModule {}
