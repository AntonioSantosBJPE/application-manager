import type { Alias, Skill, SkillCategory, SkillScopeFilter } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, exists, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { SkillCursor } from '../domain/cursor.js';
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

  /**
   * The skill a new name would duplicate for this member: a global with the same key, a global with
   * that key as an alias, or the member's own private with the same key. A global wins over a private
   * (SKL-11, SKL-12).
   */
  async findVisibleMatch(userId: string, key: string): Promise<Skill | undefined> {
    const aliasOfGlobal = exists(
      this.db
        .select({ one: sql`1` })
        .from(skillAliases)
        .where(and(eq(skillAliases.skillId, skills.id), eq(skillAliases.normalizedAlias, key))),
    );
    const [row] = await this.db
      .select({ id: skills.id, name: skills.name, category: skills.category, ownerUserId: skills.ownerUserId })
      .from(skills)
      .where(
        or(
          and(isNull(skills.ownerUserId), or(eq(skills.normalizedKey, key), aliasOfGlobal)),
          and(eq(skills.ownerUserId, userId), eq(skills.normalizedKey, key)),
        ),
      )
      .orderBy(sql`${skills.ownerUserId} is not null`, skills.id)
      .limit(1);
    return row === undefined ? undefined : toSkill(row);
  }

  /**
   * Writes the member's private skill, or answers `undefined` when the member already has one with
   * the key: the unique index decides, so two requests racing for the same key leave one row (SKL-13).
   */
  async insertPrivate(
    userId: string,
    values: { name: string; normalizedKey: string; category: SkillCategory },
  ): Promise<Skill | undefined> {
    const [row] = await this.db
      .insert(skills)
      .values({ ...values, ownerUserId: userId })
      .onConflictDoNothing()
      .returning({ id: skills.id, name: skills.name, category: skills.category, ownerUserId: skills.ownerUserId });
    return row === undefined ? undefined : toSkill(row);
  }

  /** The ids, among `ids`, that are global or private to `userId`; the caller passes only valid uuids. */
  async visibleIds(userId: string, ids: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: skills.id })
      .from(skills)
      .where(and(inArray(skills.id, ids), visibleTo(userId)));
    return rows.map((row) => row.id);
  }

  /**
   * One page of the admin catalog: the globals and the privates of every person, filtered, by key and
   * id after the cursor. `limit` is the page size plus one, so the caller can tell whether another page
   * exists. The owner of a private skill is read only to tell the scope and is never returned (SKL-33..SKL-35).
   */
  async listAdmin(input: {
    scope: SkillScopeFilter;
    category?: SkillCategory;
    key: string;
    cursor?: SkillCursor;
    limit: number;
  }): Promise<Array<Skill & { key: string }>> {
    const pattern = `%${input.key}%`;
    const aliasMatches = exists(
      this.db
        .select({ one: sql`1` })
        .from(skillAliases)
        .where(and(eq(skillAliases.skillId, skills.id), like(skillAliases.normalizedAlias, pattern))),
    );
    const rows = await this.db
      .select({
        id: skills.id,
        name: skills.name,
        category: skills.category,
        ownerUserId: skills.ownerUserId,
        key: skills.normalizedKey,
      })
      .from(skills)
      .where(
        and(
          input.scope === 'global' ? isNull(skills.ownerUserId) : undefined,
          input.scope === 'private' ? isNotNull(skills.ownerUserId) : undefined,
          input.category === undefined ? undefined : eq(skills.category, input.category),
          input.key === '' ? undefined : or(like(skills.normalizedKey, pattern), aliasMatches),
          input.cursor === undefined
            ? undefined
            : sql`(${skills.normalizedKey} collate "C", ${skills.id}) > (${input.cursor.key}::text, ${input.cursor.id}::uuid)`,
        ),
      )
      .orderBy(sql`${skills.normalizedKey} collate "C"`, skills.id)
      .limit(input.limit);
    return rows.map((row) => ({ ...toSkill(row), key: row.key }));
  }

  /** The aliases of the given skills, by skill id, each list in order of the alias key. */
  async aliasesOf(skillIds: string[]): Promise<Map<string, Alias[]>> {
    const bySkill = new Map<string, Alias[]>();
    if (skillIds.length === 0) return bySkill;
    const rows = await this.db
      .select({ id: skillAliases.id, skillId: skillAliases.skillId, alias: skillAliases.alias })
      .from(skillAliases)
      .where(inArray(skillAliases.skillId, skillIds))
      .orderBy(sql`${skillAliases.normalizedAlias} collate "C"`, asc(skillAliases.id));
    for (const row of rows) bySkill.set(row.skillId, [...(bySkill.get(row.skillId) ?? []), { id: row.id, alias: row.alias }]);
    return bySkill;
  }

  /** How many skills the whole catalog holds and how many of them are private, whatever the filters (SKL-36). */
  async counts(): Promise<{ total: number; private: number }> {
    const [row] = await this.db
      .select({
        total: sql<string>`count(*)`,
        private: sql<string>`count(*) filter (where ${skills.ownerUserId} is not null)`,
      })
      .from(skills);
    return { total: Number(row?.total ?? 0), private: Number(row?.private ?? 0) };
  }
}
