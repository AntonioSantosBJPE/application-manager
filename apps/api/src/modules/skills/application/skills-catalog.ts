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
}
