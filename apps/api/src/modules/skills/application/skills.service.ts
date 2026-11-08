import { normalizeSkillKey, type Skill } from '@am/contracts';
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
}
