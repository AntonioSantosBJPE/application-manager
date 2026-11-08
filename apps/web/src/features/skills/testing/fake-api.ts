import { type AdminSkill, type SkillCategory, type SkillScopeFilter, normalizeSkillKey } from '@am/contracts';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';
import { apiInternalUrl, problem } from './api';

export const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

const keyOf = (skill: AdminSkill) => normalizeSkillKey(skill.name);

function matches(skill: AdminSkill, key: string): boolean {
  if (key === '') return true;
  return keyOf(skill).includes(key) || skill.aliases.some((alias) => normalizeSkillKey(alias.alias).includes(key));
}

/**
 * The admin catalog as the api serves it, with state: it filters, orders alphabetically by the
 * normalized key, pages with a cursor and counts the whole catalog, and it applies promote, edit and
 * alias calls so the screen reads back what it changed. `calls` lists every request, in order, as
 * `METHOD /path?query`. `hold(name)` keeps the answer of an endpoint until the returned function runs.
 */
export function fakeCatalog(server: SetupServer, initial: AdminSkill[], pageSize = 50) {
  const skills = initial.map((skill) => ({ ...skill, aliases: [...skill.aliases] }));
  const calls: string[] = [];
  const holds = new Map<string, Promise<void>>();
  let nextAlias = 900;

  const sorted = () => [...skills].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const find = (id: unknown) => skills.find((skill) => skill.id === id);
  const waitFor = async (name: string) => {
    await holds.get(name);
  };

  server.use(
    http.get(`${apiInternalUrl}/admin/skills`, ({ request }) => {
      const url = new URL(request.url);
      calls.push(`GET ${url.pathname}${url.search}`);
      const scope = (url.searchParams.get('scope') ?? 'all') as SkillScopeFilter;
      const category = url.searchParams.get('category') as SkillCategory | null;
      const key = normalizeSkillKey(url.searchParams.get('q') ?? '');
      const cursor = url.searchParams.get('cursor');
      const found = sorted().filter(
        (skill) =>
          (scope === 'all' || skill.scope === scope) &&
          (category === null || skill.category === category) &&
          matches(skill, key),
      );
      const start = cursor === null ? 0 : found.findIndex((skill) => skill.id === cursor) + 1;
      const items = found.slice(start, start + pageSize);
      return HttpResponse.json({
        items,
        nextCursor: start + pageSize < found.length ? items[items.length - 1]!.id : null,
        counts: { total: skills.length, private: skills.filter((skill) => skill.scope === 'private').length },
      });
    }),
    http.post(`${apiInternalUrl}/skills/:id/promote`, async ({ params }) => {
      calls.push(`POST /skills/${String(params.id)}/promote`);
      await waitFor('promote');
      const skill = find(params.id);
      if (skill === undefined) return problem(404);
      skill.scope = 'global';
      return HttpResponse.json({ id: skill.id, name: skill.name, category: skill.category, scope: skill.scope });
    }),
    http.patch(`${apiInternalUrl}/skills/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { name?: string; category?: SkillCategory };
      calls.push(`PATCH /skills/${String(params.id)} ${JSON.stringify(body)}`);
      await waitFor('update');
      const skill = find(params.id);
      if (skill === undefined) return problem(404);
      if (body.name !== undefined) skill.name = body.name;
      if (body.category !== undefined) skill.category = body.category;
      return HttpResponse.json({ id: skill.id, name: skill.name, category: skill.category, scope: skill.scope });
    }),
    http.post(`${apiInternalUrl}/skills/:id/aliases`, async ({ params, request }) => {
      const body = (await request.json()) as { alias: string };
      calls.push(`POST /skills/${String(params.id)}/aliases ${JSON.stringify(body)}`);
      await waitFor('addAlias');
      const skill = find(params.id);
      if (skill === undefined) return problem(404);
      const alias = { id: uuid(nextAlias++), alias: body.alias };
      skill.aliases.push(alias);
      return HttpResponse.json(alias, { status: 201 });
    }),
    http.patch(`${apiInternalUrl}/skills/:id/aliases/:aliasId`, async ({ params, request }) => {
      const body = (await request.json()) as { alias: string };
      calls.push(`PATCH /skills/${String(params.id)}/aliases/${String(params.aliasId)} ${JSON.stringify(body)}`);
      await waitFor('updateAlias');
      const alias = find(params.id)?.aliases.find((item) => item.id === params.aliasId);
      if (alias === undefined) return problem(404);
      alias.alias = body.alias;
      return HttpResponse.json(alias);
    }),
    http.delete(`${apiInternalUrl}/skills/:id/aliases/:aliasId`, async ({ params }) => {
      calls.push(`DELETE /skills/${String(params.id)}/aliases/${String(params.aliasId)}`);
      await waitFor('removeAlias');
      const skill = find(params.id);
      const index = skill?.aliases.findIndex((item) => item.id === params.aliasId) ?? -1;
      if (skill === undefined || index === -1) return problem(404);
      skill.aliases.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    calls,
    skills,
    /** Calls of one endpoint, such as `callsTo('POST', '/promote')`. */
    callsTo: (method: string, part: string) => calls.filter((call) => call.startsWith(method) && call.includes(part)),
    hold(name: 'promote' | 'update' | 'addAlias' | 'updateAlias' | 'removeAlias'): () => void {
      let release: () => void = () => undefined;
      holds.set(
        name,
        new Promise<void>((resolve) => {
          release = () => {
            holds.delete(name);
            resolve();
          };
        }),
      );
      return release;
    },
  };
}
