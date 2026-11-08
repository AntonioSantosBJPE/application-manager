import { normalizeSkillKey, type CreateSkillRequest, type Skill } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { SkillsRepository } from '../infra/skills.repository.js';

/** The selector lists at most this many skills, with no cursor. */
export const SEARCH_LIMIT = 20;

/** The member's use of the catalog: search and create (SKL-05..SKL-16). */
@Injectable()
export class SkillsService {
  constructor(private readonly repository: SkillsRepository) {}

  search(userId: string, q: string | undefined): Promise<Skill[]> {
    return this.repository.search(userId, normalizeSkillKey(q ?? ''), SEARCH_LIMIT);
  }

  /**
   * Creates the member's private skill, or answers the skill the name already is: a global, the alias
   * of a global or the member's own private. The category sent is ignored for an existing skill, so a
   * name never gets two ids (SKL-11, SKL-12). The owner is the caller's id and nothing else (SKL-16).
   */
  async create(userId: string, { name, category }: CreateSkillRequest): Promise<{ skill: Skill; created: boolean }> {
    const key = normalizeSkillKey(name);
    const existing = await this.repository.findVisibleMatch(userId, key);
    if (existing !== undefined) return { skill: existing, created: false };

    const inserted = await this.repository.insertPrivate(userId, { name, normalizedKey: key, category });
    if (inserted !== undefined) return { skill: inserted, created: true };

    // A request of the same member took the key between the check and the write: answer its skill (SKL-13).
    const winner = await this.repository.findVisibleMatch(userId, key);
    if (winner === undefined) throw new Error('A private skill vanished right after a key conflict');
    return { skill: winner, created: false };
  }
}
