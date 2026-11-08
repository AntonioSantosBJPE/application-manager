import { normalizeSkillKey, type Skill } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { isUuid } from '../domain/ids.js';
import { SkillsRepository } from '../infra/skills.repository.js';

/**
 * What the other modules (Application, MasterResume) ask of the catalog, so none of them reads the
 * `skills` schema (Key decision 2).
 */
@Injectable()
export class SkillsCatalog {
  constructor(private readonly repository: SkillsRepository) {}

  /**
   * The ids, among `ids`, the user may use: global skills and the user's own private ones, in the
   * order given and without repeats. An id of somebody else's private skill, an id that does not
   * exist and text that is not a uuid are left out (SKL-58, SKL-59).
   */
  async visibleIds(userId: string, ids: readonly string[]): Promise<string[]> {
    const candidates = [...new Set(ids.filter(isUuid))];
    if (candidates.length === 0) return [];
    const visible = new Set(await this.repository.visibleIds(userId, candidates));
    return candidates.filter((id) => visible.has(id));
  }

  /**
   * The official name, category and scope of the skills among `ids` that the user may see, by id. An
   * id of somebody else's private skill, an id that does not exist and text that is not a uuid are
   * left out (APP-08, APP-88). A promoted skill keeps its id and shows up as `global`.
   */
  async describe(userId: string, ids: readonly string[]): Promise<Map<string, Skill>> {
    const candidates = [...new Set(ids.filter(isUuid))];
    if (candidates.length === 0) return new Map();
    const found = await this.repository.describe(userId, candidates);
    return new Map(found.map((skill) => [skill.id, skill]));
  }

  /**
   * The ids of the skills the user may see whose name, or an alias, contains the normalized `key`
   * (`nodejs` finds "Node.js" by its alias). A key with no letter or digit matches nothing (APP-13).
   */
  async matchingIds(userId: string, key: string): Promise<string[]> {
    const normalized = normalizeSkillKey(key);
    if (normalized === '') return [];
    return this.repository.matchingIds(userId, normalized);
  }
}
