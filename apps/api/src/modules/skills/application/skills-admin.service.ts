import { normalizeSkillKey, type AdminSkillsPage } from '@am/contracts';
import type { AdminSkillsQuery } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { encodeCursor, type SkillCursor } from '../domain/cursor.js';
import { SkillsRepository } from '../infra/skills.repository.js';

/** The admin lists 50 skills per page. */
export const ADMIN_PAGE_SIZE = 50;

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
}
