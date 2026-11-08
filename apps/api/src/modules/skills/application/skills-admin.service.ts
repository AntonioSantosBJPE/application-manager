import { normalizeSkillKey, type AdminSkillsPage, type AdminSkillsQuery, type Alias, type Skill, type UpdateSkillRequest } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { encodeCursor, type SkillCursor } from '../domain/cursor.js';
import { isUuid } from '../domain/ids.js';
import { isUniqueViolation, SkillsRepository, type DatabaseExecutor, type SkillRecord } from '../infra/skills.repository.js';

/** The admin lists 50 skills per page. */
export const ADMIN_PAGE_SIZE = 50;

type SkillEvent = 'skill.updated' | 'skill.promoted' | 'skill.alias_created' | 'skill.alias_updated' | 'skill.alias_removed';

/** The skill, or the alias, does not exist (`404`). */
export class SkillNotFoundError extends Error {}
/** The name or alias collides with a global name or an alias (`409`). */
export class SkillConflictError extends Error {}
/** Aliases and edits belong to global skills only (`422`). */
export class SkillNotGlobalError extends Error {}

/** What the admin does with the catalog: list, promote, edit and give aliases (SKL-17..SKL-37, SKL-62..SKL-71). */
@Injectable()
export class SkillsAdminService {
  constructor(
    private readonly repository: SkillsRepository,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * One structured event per change: the operation, the skill and the person who acted, and nothing
   * else. The name, the alias text, the e-mail and the session never go in (SKL-60, SKL-61).
   */
  private record(event: SkillEvent, skillId: string, actorId: string): void {
    this.logger.info({ event, skillId, actorId });
  }

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
  async promote(id: string, actorId: string): Promise<Skill> {
    const { skill, changed } = await this.writingGlobalNames(async (tx) => {
      const current = await this.existing(id, tx);
      if (current.ownerUserId === null) {
        return { skill: { id: current.id, name: current.name, category: current.category, scope: 'global' as const }, changed: false };
      }
      await this.ensureKeyFree(current.normalizedKey, undefined, tx);
      return { skill: await this.repository.makeGlobal(current.id, tx), changed: true };
    });
    if (changed) this.record('skill.promoted', skill.id, actorId);
    return skill;
  }

  /**
   * Gives a global skill an alias, keeping the text as typed (SKL-26..SKL-31). The alias already on
   * this skill is answered as it is; a key that is a global name (the skill's own included) or the
   * alias of another skill is refused. Same lock as the promotion.
   */
  async addAlias(skillId: string, alias: string, actorId: string): Promise<{ alias: Alias; created: boolean }> {
    const result = await this.writingGlobalNames(async (tx) => {
      const skill = await this.existing(skillId, tx);
      if (skill.ownerUserId !== null) throw new SkillNotGlobalError('Aliases belong to global skills');
      const key = normalizeSkillKey(alias);
      const held = await this.repository.aliasWithKey(key, tx);
      if (held?.skillId === skill.id) return { alias: { id: held.id, alias: held.alias }, created: false };
      await this.ensureKeyFree(key, undefined, tx);
      const inserted = await this.repository.insertAlias({ skillId: skill.id, alias, normalizedAlias: key }, tx);
      return { alias: inserted, created: true };
    });
    if (result.created) this.record('skill.alias_created', skillId, actorId);
    return result;
  }

  /**
   * Changes the name and the category of a global skill; the id stays and the key is worked out again
   * (SKL-62..SKL-66). The new key may not be another global's key or any alias, the skill's own
   * included; the same key in another spelling is fine. No alias is made from the old name.
   */
  async update(id: string, { name, category }: UpdateSkillRequest, actorId: string): Promise<Skill> {
    const updated = await this.writingGlobalNames(async (tx) => {
      const skill = await this.existing(id, tx);
      if (skill.ownerUserId !== null) throw new SkillNotGlobalError('Only global skills can be edited');
      const normalizedKey = name === undefined ? undefined : normalizeSkillKey(name);
      if (normalizedKey !== undefined) await this.ensureKeyFree(normalizedKey, skill.id, tx);
      return this.repository.updateSkill(skill.id, { name, normalizedKey, category }, tx);
    });
    this.record('skill.updated', updated.id, actorId);
    return updated;
  }

  /**
   * Changes the text and the key of an alias (SKL-67, SKL-68). The key may not be a global name or
   * the alias of any other row; the same key in another spelling is fine. Same lock as the other writes.
   */
  async updateAlias(skillId: string, aliasId: string, alias: string, actorId: string): Promise<Alias> {
    const updated = await this.writingGlobalNames(async (tx) => {
      const current = await this.aliasOf(skillId, aliasId, tx);
      const key = normalizeSkillKey(alias);
      const held = await this.repository.aliasWithKey(key, tx);
      if ((await this.repository.globalKeyTaken(key, undefined, tx)) || (held !== undefined && held.id !== current.id)) {
        throw new SkillConflictError('The key is already a global name or an alias');
      }
      return this.repository.updateAlias(current.id, { alias, normalizedAlias: key }, tx);
    });
    this.record('skill.alias_updated', skillId, actorId);
    return updated;
  }

  /** Deletes an alias; the search for it stops finding the skill (SKL-69, SKL-70). It frees a name, so it needs no lock. */
  async removeAlias(skillId: string, aliasId: string, actorId: string): Promise<void> {
    const removed = isUuid(skillId) && isUuid(aliasId) && (await this.repository.deleteAlias(skillId, aliasId));
    if (!removed) throw new SkillNotFoundError('Alias not found');
    this.record('skill.alias_removed', skillId, actorId);
  }

  private async aliasOf(skillId: string, aliasId: string, tx: DatabaseExecutor): Promise<Alias> {
    const alias = isUuid(skillId) && isUuid(aliasId) ? await this.repository.findAlias(skillId, aliasId, tx) : undefined;
    if (alias === undefined) throw new SkillNotFoundError('Alias not found');
    return alias;
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
