import { normalizeSkillKey, type AdminSkillsPage, type AdminSkillsQuery, type Alias, type Skill } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { encodeCursor, type SkillCursor } from '../domain/cursor.js';
import { isUuid } from '../domain/ids.js';
import { isUniqueViolation, SkillsRepository, type DatabaseExecutor, type SkillRecord } from '../infra/skills.repository.js';

/** The admin lists 50 skills per page. */
export const ADMIN_PAGE_SIZE = 50;

/** The skill, or the alias, does not exist (`404`). */
export class SkillNotFoundError extends Error {}
/** The name or alias collides with a global name or an alias (`409`). */
export class SkillConflictError extends Error {}
/** Aliases and edits belong to global skills only (`422`). */
export class SkillNotGlobalError extends Error {}

/** What the admin does with the catalog: list, promote, edit and give aliases (SKL-17..SKL-37, SKL-62..SKL-71). */
@Injectable()
export class SkillsAdminService {
  constructor(private readonly repository: SkillsRepository) {}

  /**
   * One page of the catalog with the privates of every person and no owner anywhere, plus the counts
   * of the whole catalog (SKL-33..SKL-36).
   */
  async list(query: Omit<AdminSkillsQuery, 'cursor'> & { cursor?: SkillCursor }): Promise<AdminSkillsPage> {
    const rows = await this.repository.listAdmin({
      scope: query.scope,
      category: query.category,
      key: normalizeSkillKey(query.q ?? ''),
      cursor: query.cursor,
      limit: ADMIN_PAGE_SIZE + 1,
    });
    const page = rows.slice(0, ADMIN_PAGE_SIZE);
    const [aliases, counts] = await Promise.all([this.repository.aliasesOf(page.map((skill) => skill.id)), this.repository.counts()]);
    const last = page.at(-1);
    return {
      items: page.map((skill) => ({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        scope: skill.scope,
        aliases: aliases.get(skill.id) ?? [],
      })),
      nextCursor: rows.length > ADMIN_PAGE_SIZE && last !== undefined ? encodeCursor({ key: last.key, id: last.id }) : null,
      counts,
    };
  }

  /**
   * Makes a private skill global, keeping its id (SKL-17..SKL-21, SKL-24). It runs in a transaction that
   * takes the lock of the global names before it reads, so two promotions of one key, or a promotion
   * and an alias of that key, line up and the second one sees the first's result.
   */
  promote(id: string): Promise<Skill> {
    return this.writingGlobalNames(async (tx) => {
      const skill = await this.existing(id, tx);
      if (skill.ownerUserId === null) return { id: skill.id, name: skill.name, category: skill.category, scope: 'global' };
      await this.ensureKeyFree(skill.normalizedKey, undefined, tx);
      return this.repository.makeGlobal(skill.id, tx);
    });
  }

  /**
   * Gives a global skill an alias, keeping the text as typed (SKL-26..SKL-31). The alias already on
   * this skill is answered as it is; a key that is a global name (the skill's own included) or the
   * alias of another skill is refused. Same lock as the promotion.
   */
  addAlias(skillId: string, alias: string): Promise<{ alias: Alias; created: boolean }> {
    return this.writingGlobalNames(async (tx) => {
      const skill = await this.existing(skillId, tx);
      if (skill.ownerUserId !== null) throw new SkillNotGlobalError('Aliases belong to global skills');
      const key = normalizeSkillKey(alias);
      const held = await this.repository.aliasWithKey(key, tx);
      if (held?.skillId === skill.id) return { alias: { id: held.id, alias: held.alias }, created: false };
      await this.ensureKeyFree(key, undefined, tx);
      const inserted = await this.repository.insertAlias({ skillId: skill.id, alias, normalizedAlias: key }, tx);
      return { alias: inserted, created: true };
    });
  }

  /**
   * Runs a write of a global name in a transaction that starts with the lock, so the checks and the
   * write see the same names. A unique index that still fires is the same conflict (`409`).
   */
  private async writingGlobalNames<T>(write: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    try {
      return await this.repository.transaction(async (tx) => {
        await this.repository.lockGlobalNames(tx);
        return write(tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new SkillConflictError('A unique index of the catalog refused the write');
      throw error;
    }
  }

  private async existing(id: string, tx: DatabaseExecutor): Promise<SkillRecord> {
    const skill = isUuid(id) ? await this.repository.findById(id, tx) : undefined;
    if (skill === undefined) throw new SkillNotFoundError('Skill not found');
    return skill;
  }

  /** The key is free when no other global has it and no alias has it. */
  private async ensureKeyFree(key: string, exceptSkillId: string | undefined, tx: DatabaseExecutor): Promise<void> {
    if ((await this.repository.globalKeyTaken(key, exceptSkillId, tx)) || (await this.repository.aliasWithKey(key, tx)) !== undefined) {
      throw new SkillConflictError('The key is already a global name or an alias');
    }
  }
}
