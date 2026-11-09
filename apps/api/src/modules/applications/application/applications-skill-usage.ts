import { Inject, Injectable } from '@nestjs/common';
import { count, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { SkillUsage } from '../../skills/index.js';
import { jobPostingSkills } from '../infra/schema.js';

/**
 * How many job postings use each skill, across every person: the one number the admin catalog shows
 * (APP-85, APP-86). Nothing else of a posting, and never its owner, leaves this class.
 */
@Injectable()
export class ApplicationsSkillUsage implements SkillUsage {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async countFor(skillIds: readonly string[]): Promise<Map<string, number>> {
    if (skillIds.length === 0) return new Map();
    const rows = await this.db
      .select({ skillId: jobPostingSkills.skillId, total: count() })
      .from(jobPostingSkills)
      .where(sql`${jobPostingSkills.skillId} = any(${sql.param([...skillIds])}::uuid[])`)
      .groupBy(jobPostingSkills.skillId);
    return new Map(rows.map((row) => [row.skillId, row.total]));
  }
}
