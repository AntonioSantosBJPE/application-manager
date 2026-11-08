import type { Skill, SkillCategory } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, exists, isNull, like, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import { skillAliases, skills } from './schema.js';

/** The visibility rule of the member: the globals and the member's own privates (Key decision 1). */
const visibleTo = (userId: string) => or(isNull(skills.ownerUserId), eq(skills.ownerUserId, userId));

const toSkill = (row: { id: string; name: string; category: SkillCategory; ownerUserId: string | null }): Skill => ({
  id: row.id,
  name: row.name,
  category: row.category,
  scope: row.ownerUserId === null ? 'global' : 'private',
});

/**
 * SQL for `skills.skills` and `skills.skill_aliases`. Whether a request is allowed or a name is a
 * duplicate is decided by the services; this class only reads and writes rows. Keys are compared in
 * the `C` collation, so "alphabetical order of the key" is the same on every database.
 */
@Injectable()
export class SkillsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * The skills a member sees whose name key, or the key of an alias, contains `key`: first those
   * that match by name, then those that match only by alias, each group by key; an empty `key` lists
   * the first ones (SKL-05..SKL-07).
   */
  async search(userId: string, key: string, limit: number): Promise<Skill[]> {
    const columns = {
      id: skills.id,
      name: skills.name,
      category: skills.category,
      ownerUserId: skills.ownerUserId,
    };
    const byKey = sql`${skills.normalizedKey} collate "C"`;

    if (key === '') {
      const rows = await this.db.select(columns).from(skills).where(visibleTo(userId)).orderBy(byKey, skills.id).limit(limit);
      return rows.map(toSkill);
    }

    const pattern = `%${key}%`;
    const aliasMatches = exists(
      this.db
        .select({ one: sql`1` })
        .from(skillAliases)
        .where(and(eq(skillAliases.skillId, skills.id), like(skillAliases.normalizedAlias, pattern))),
    );
    const rows = await this.db
      .select(columns)
      .from(skills)
      .where(and(visibleTo(userId), or(like(skills.normalizedKey, pattern), aliasMatches)))
      .orderBy(sql`not (${skills.normalizedKey} like ${pattern})`, byKey, skills.id)
      .limit(limit);
    return rows.map(toSkill);
  }
}
