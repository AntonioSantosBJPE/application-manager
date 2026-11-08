import type { Alias, Skill, SkillCategory, SkillScopeFilter } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, exists, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { SkillCursor } from '../domain/cursor.js';
import { skillAliases, skills } from './schema.js';

/**
 * What a write of the admin runs on: the database or a transaction of it. The lock of the global
 * names only means something inside a transaction, so the writes receive the transaction's handle.
 */
export type DatabaseExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

/** Postgres answers a violated unique index with this SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** Whether the failure is a unique index of the catalog: the safety net under the lock (SKL-24, SKL-32). */
export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown }).cause;
  return [error, cause].some((candidate) => (candidate as { code?: string } | undefined)?.code === UNIQUE_VIOLATION);
}

export interface SkillRecord {
  id: string;
  name: string;
  normalizedKey: string;
  category: SkillCategory;
  ownerUserId: string | null;
}

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

  /** The skills among `ids` that are global or private to `userId`, with name, category and scope; the caller passes only valid uuids. */
  async describe(userId: string, ids: string[]): Promise<Skill[]> {
    const rows = await this.db
      .select({ id: skills.id, name: skills.name, category: skills.category, ownerUserId: skills.ownerUserId })
      .from(skills)
      .where(and(inArray(skills.id, ids), visibleTo(userId)));
    return rows.map(toSkill);
  }

  /** The ids of the skills a member sees whose name key, or the key of an alias, contains `key` (a normalized, non-empty key). */
  async matchingIds(userId: string, key: string): Promise<string[]> {
    const pattern = `%${key}%`;
    const aliasMatches = exists(
      this.db
        .select({ one: sql`1` })
        .from(skillAliases)
        .where(and(eq(skillAliases.skillId, skills.id), like(skillAliases.normalizedAlias, pattern))),
    );
    const rows = await this.db
      .select({ id: skills.id })
      .from(skills)
      .where(and(visibleTo(userId), or(like(skills.normalizedKey, pattern), aliasMatches)));
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

  /** A transaction handle, so the lock, the check and the write are one step. */
  transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(run);
  }

  /**
   * Takes the one lock every write of a global name takes, until the transaction ends: promote, create
   * an alias, rename, edit an alias. The write that gets it second reads what the first one committed.
   */
  async lockGlobalNames(tx: DatabaseExecutor): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('skills.global-names', 0))`);
  }

  async findById(id: string, executor: DatabaseExecutor = this.db): Promise<SkillRecord | undefined> {
    const [row] = await executor
      .select({
        id: skills.id,
        name: skills.name,
        normalizedKey: skills.normalizedKey,
        category: skills.category,
        ownerUserId: skills.ownerUserId,
      })
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);
    return row;
  }

  /** Whether a global skill other than `exceptId` has the key. */
  async globalKeyTaken(key: string, exceptId: string | undefined, executor: DatabaseExecutor = this.db): Promise<boolean> {
    const [row] = await executor
      .select({ id: skills.id })
      .from(skills)
      .where(
        and(isNull(skills.ownerUserId), eq(skills.normalizedKey, key), exceptId === undefined ? undefined : sql`${skills.id} <> ${exceptId}::uuid`),
      )
      .limit(1);
    return row !== undefined;
  }

  /** The alias that has the key, whichever skill it belongs to. */
  async aliasWithKey(
    key: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<{ id: string; skillId: string; alias: string } | undefined> {
    const [row] = await executor
      .select({ id: skillAliases.id, skillId: skillAliases.skillId, alias: skillAliases.alias })
      .from(skillAliases)
      .where(eq(skillAliases.normalizedAlias, key))
      .limit(1);
    return row;
  }

  /** Makes a private skill global, keeping its id, name and category. */
  async makeGlobal(id: string, executor: DatabaseExecutor = this.db): Promise<Skill> {
    const [row] = await executor
      .update(skills)
      .set({ ownerUserId: null })
      .where(eq(skills.id, id))
      .returning({ id: skills.id, name: skills.name, category: skills.category, ownerUserId: skills.ownerUserId });
    return toSkill(row!);
  }

  async insertAlias(
    values: { skillId: string; alias: string; normalizedAlias: string },
    executor: DatabaseExecutor = this.db,
  ): Promise<Alias> {
    const [row] = await executor.insert(skillAliases).values(values).returning({ id: skillAliases.id, alias: skillAliases.alias });
    return row!;
  }

  /** Changes the name, with its key, and the category of a skill; the id stays. */
  async updateSkill(
    id: string,
    patch: { name?: string; normalizedKey?: string; category?: SkillCategory },
    executor: DatabaseExecutor = this.db,
  ): Promise<Skill> {
    const [row] = await executor
      .update(skills)
      .set(patch)
      .where(eq(skills.id, id))
      .returning({ id: skills.id, name: skills.name, category: skills.category, ownerUserId: skills.ownerUserId });
    return toSkill(row!);
  }

  /** The alias with this id that belongs to this skill; an alias of another skill is not found. */
  async findAlias(skillId: string, aliasId: string, executor: DatabaseExecutor = this.db): Promise<Alias | undefined> {
    const [row] = await executor
      .select({ id: skillAliases.id, alias: skillAliases.alias })
      .from(skillAliases)
      .where(and(eq(skillAliases.id, aliasId), eq(skillAliases.skillId, skillId)))
      .limit(1);
    return row;
  }

  async updateAlias(
    aliasId: string,
    values: { alias: string; normalizedAlias: string },
    executor: DatabaseExecutor = this.db,
  ): Promise<Alias> {
    const [row] = await executor
      .update(skillAliases)
      .set(values)
      .where(eq(skillAliases.id, aliasId))
      .returning({ id: skillAliases.id, alias: skillAliases.alias });
    return row!;
  }

  /** Deletes the alias of this skill, or reports that there is none. */
  async deleteAlias(skillId: string, aliasId: string, executor: DatabaseExecutor = this.db): Promise<boolean> {
    const deleted = await executor
      .delete(skillAliases)
      .where(and(eq(skillAliases.id, aliasId), eq(skillAliases.skillId, skillId)))
      .returning({ id: skillAliases.id });
    return deleted.length > 0;
  }
}
