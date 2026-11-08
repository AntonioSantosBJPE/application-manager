import { adminSkillsPageSchema, applicationDetailSchema, skillSchema, type AdminSkillsPage } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

type Account = ApplicationsEnv['ana'];

const catalogPage = async (env: ApplicationsEnv, path = ''): Promise<AdminSkillsPage> => {
  const response = await call(env, env.admin, 'GET', `/admin/skills${path}`);
  expect(response.status).toBe(200);
  return adminSkillsPageSchema.parse(await response.json());
};

/** The whole catalog, page after page, each page as the API answered it. */
const wholeCatalog = async (env: ApplicationsEnv, filter = ''): Promise<AdminSkillsPage[]> => {
  const pages: AdminSkillsPage[] = [];
  let cursor: string | null = null;
  do {
    const joined: string = cursor === null ? filter : `${filter}${filter === '' ? '?' : '&'}cursor=${encodeURIComponent(cursor)}`;
    const page: AdminSkillsPage = await catalogPage(env, joined);
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return pages;
};

const postWith = async (env: ApplicationsEnv, account: Account, skillIds: string[], extra: Record<string, unknown> = {}) =>
  applicationDetailSchema.parse(
    await (
      await call(env, account, 'POST', '/applications', applicationBody(extra, { skills: skillIds.map((skillId) => ({ skillId, requirement: 'required' })) }))
    ).json(),
  );

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

/** How many postings the admin catalog says use the skill, read with a search that brings it. */
const countOf = async (env: ApplicationsEnv, skillId: string, name: string): Promise<number | undefined> => {
  const found = (await catalogPage(env, `?q=${encodeURIComponent(name)}`)).items.find((item) => item.id === skillId);
  return found?.postingCount;
};

describe('GET /admin/skills posting counts', () => {
  it('APP-85 counts the postings of two people on the skills of two pages of the catalog, 0 for a skill no posting uses, in the same order and paging as before', async () => {
    await withApplicationsEnv('skills_usage_pages', async (env) => {
      const privateSkill = skillSchema.parse(await (await call(env, env.ana, 'POST', '/skills', { name: 'Skill Fictícia Alfa', category: 'tool' })).json());
      const emptyPages = await wholeCatalog(env);
      const [first, second] = emptyPages;
      expect(emptyPages.length).toBeGreaterThan(1);
      const onFirst = first!.items;
      const onSecond = second!.items;
      // Before any posting every row says 0.
      expect(emptyPages.flatMap((page) => page.items).every((item) => item.postingCount === 0)).toBe(true);

      // Skills on the first page and on the second one, used by Ana, by Bruno or by both.
      await postWith(env, env.ana, [onFirst[0]!.id]);
      await postWith(env, env.ana, [onFirst[0]!.id, onSecond[0]!.id]);
      await postWith(env, env.bruno, [onFirst[0]!.id, onFirst.at(-1)!.id]);
      await postWith(env, env.ana, [onSecond[5]!.id, privateSkill.id]);
      await postWith(env, env.ana, [onSecond[5]!.id, privateSkill.id]);
      await postWith(env, env.bruno, [onSecond[5]!.id]);
      await postWith(env, env.bruno, [onSecond[5]!.id]);
      const expected = new Map<string, number>([
        [onFirst[0]!.id, 3],
        [onFirst.at(-1)!.id, 1],
        [onSecond[0]!.id, 1],
        [onSecond[5]!.id, 4],
        [privateSkill.id, 2],
      ]);

      const pages = await wholeCatalog(env);

      // The same pages as before: the same skills in the same order, the same cursors and the same counters.
      expect(pages.map((page) => page.items.map((item) => item.id))).toEqual(emptyPages.map((page) => page.items.map((item) => item.id)));
      expect(pages.map((page) => page.nextCursor)).toEqual(emptyPages.map((page) => page.nextCursor));
      expect(pages.map((page) => page.counts)).toEqual(emptyPages.map((page) => page.counts));
      for (const [index, page] of pages.entries()) {
        for (const item of page.items) {
          expect(item.postingCount, `${item.name} on page ${index + 1}`).toBe(expected.get(item.id) ?? 0);
        }
      }
      expect(pages[0]!.items.some((item) => item.postingCount > 0)).toBe(true);
      expect(pages[1]!.items.some((item) => item.postingCount > 0)).toBe(true);
      expect(pages.flatMap((page) => page.items).filter((item) => item.postingCount === 0).length).toBeGreaterThan(300);
      expect(pages.at(-1)!.nextCursor).toBeNull();
      expect(pages.flatMap((page) => page.items).some((item) => item.id === privateSkill.id)).toBe(true);
    });
  });

  it('APP-85 keeps the alphabetical order and the cursors of the catalog whatever the counts are', async () => {
    await withApplicationsEnv('skills_usage_order', async (env) => {
      const before = await wholeCatalog(env);
      const last = before.at(-1)!.items.at(-1)!;
      const middle = before[1]!.items[20]!;
      await postWith(env, env.ana, [last.id, middle.id]);
      await postWith(env, env.bruno, [last.id]);

      const after = await wholeCatalog(env);

      expect(after.map((page) => page.items.map((item) => item.id))).toEqual(before.map((page) => page.items.map((item) => item.id)));
      expect(after.map((page) => page.nextCursor)).toEqual(before.map((page) => page.nextCursor));
      expect(after.map((page) => page.counts)).toEqual(before.map((page) => page.counts));
      expect(after.flatMap((page) => page.items).find((item) => item.id === last.id)?.postingCount).toBe(2);
      expect(after.flatMap((page) => page.items).find((item) => item.id === middle.id)?.postingCount).toBe(1);
    });
  });

  it('APP-85 shows the count under the scope, category and search filters too', async () => {
    await withApplicationsEnv('skills_usage_filters', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const own = skillSchema.parse(await (await call(env, env.ana, 'POST', '/skills', { name: 'Skill Fictícia Beta', category: 'tool' })).json());
      await postWith(env, env.ana, [node, own.id]);
      await postWith(env, env.bruno, [node]);

      const privates = await catalogPage(env, '?scope=private');
      const searched = await catalogPage(env, '?q=nodejs');

      expect(privates.items.map((item) => [item.id, item.postingCount])).toEqual([[own.id, 1]]);
      expect(searched.items.find((item) => item.id === node)?.postingCount).toBe(2);
    });
  });

  it('APP-86 answers the count and nothing else of a posting: no owner, company, title, link, description or application id', async () => {
    await withApplicationsEnv('skills_usage_privacy', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const created = await postWith(env, env.ana, [node], {
        company: 'MARCADOR-EMPRESA-86',
        title: 'MARCADOR-TITULO-86',
        url: 'https://marcador-86.exemplo.com/vaga',
        location: 'MARCADOR-LOCAL-86',
        description: 'MARCADOR-DESCRICAO-86',
      });
      await call(env, env.ana, 'POST', `/applications/${created.id}/events`, { kind: 'note', note: 'MARCADOR-NOTA-86' });
      await postWith(env, env.bruno, [node]);
      const postingIds = (await query<{ id: string }>(env.databaseUrl, 'select id from applications.job_postings')).map((row) => row.id);
      const applicationIds = (await query<{ id: string }>(env.databaseUrl, 'select id from applications.applications')).map((row) => row.id);
      expect(postingIds).toHaveLength(2);

      for (const path of ['', '?scope=global', '?q=nodejs']) {
        const response = await call(env, env.admin, 'GET', `/admin/skills${path}`);
        const text = await response.text();
        const body = JSON.parse(text) as AdminSkillsPage;

        for (const item of body.items) {
          expect(Object.keys(item).sort(), path).toEqual(['aliases', 'category', 'id', 'name', 'postingCount', 'scope']);
        }
        const forbidden = [
          env.ana.id,
          env.bruno.id,
          env.ana.email,
          env.bruno.email,
          ...postingIds,
          ...applicationIds,
          'MARCADOR',
          'marcador-86',
          'Empresa Fictícia Alfa',
          'Vaga de Teste Pleno',
        ];
        for (const value of forbidden) expect(text, `${path} holds ${value}`).not.toContain(value);
      }
      expect(await countOf(env, node, 'Node.js')).toBe(2);
    });
  });

  it('APP-87 changes the count on the next read when a posting gains a skill, swaps it for another, loses it or is deleted', async () => {
    await withApplicationsEnv('skills_usage_changes', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const redis = await globalSkillId(env, 'redis');
      expect(await countOf(env, node, 'Node.js')).toBe(0);
      expect(await countOf(env, redis, 'Redis')).toBe(0);

      // A new posting with the skill.
      const first = await postWith(env, env.ana, [node]);
      expect(await countOf(env, node, 'Node.js')).toBe(1);

      // Swapping the skills of the posting moves the count from one to the other.
      const swap = (id: string, skillIds: string[]) =>
        call(env, env.ana, 'PUT', `/applications/${id}/skills`, skillIds.map((skillId) => ({ skillId, requirement: 'required' })));
      expect((await swap(first.id, [redis])).status).toBe(200);
      expect(await countOf(env, node, 'Node.js')).toBe(0);
      expect(await countOf(env, redis, 'Redis')).toBe(1);

      // A posting gains one more, of the other person.
      expect((await swap(first.id, [node, redis])).status).toBe(200);
      const second = await postWith(env, env.bruno, [node]);
      expect(await countOf(env, node, 'Node.js')).toBe(2);
      expect(await countOf(env, redis, 'Redis')).toBe(1);

      // A posting loses all its skills.
      expect((await swap(first.id, [])).status).toBe(200);
      expect(await countOf(env, node, 'Node.js')).toBe(1);
      expect(await countOf(env, redis, 'Redis')).toBe(0);

      // Deleting the posting takes its skills out of the count.
      expect((await call(env, env.bruno, 'DELETE', `/applications/${second.id}`)).status).toBe(204);
      expect(await countOf(env, node, 'Node.js')).toBe(0);
    });
  });
});
