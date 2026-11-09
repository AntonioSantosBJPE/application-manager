import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiRequestContext } from '../../../lib/call-api';
import {
  ADMIN_SKILLS_ENDPOINTS,
  createSkillAlias,
  deleteSkillAlias,
  loadAdminSkills,
  patchSkill,
  patchSkillAlias,
  promoteSkillById,
} from './server-functions';

const apiInternalUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const context: ApiRequestContext = {
  apiInternalUrl,
  requestId: 'req-1',
  cookie: 'am_session=token-admin',
  clientIp: '203.0.113.7',
};

const skillId = '8f6a1c2e-0000-7000-8000-000000000001';
const aliasId = '8f6a1c2e-0000-7000-8000-000000000002';
const alfa = { id: skillId, name: 'Skill Fictícia Alfa', category: 'tool', scope: 'global' };
const alias = { id: aliasId, alias: 'alfa-apelido' };
const page = {
  items: [{ ...alfa, aliases: [alias], postingCount: 0 }],
  nextCursor: null,
  counts: { total: 1, private: 0 },
};

/** Runs one call and collects what reached the api: method, path with query, and body. */
async function call<T>(
  run: (context: ApiRequestContext) => Promise<T>,
  respond: (request: Request) => Response | Promise<Response>,
) {
  const received: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.all(`${apiInternalUrl}/*`, async ({ request }) => {
      const text = await request.text();
      const url = new URL(request.url);
      received.push({
        method: request.method,
        path: url.pathname + url.search,
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      });
      return respond(request);
    }),
  );
  return { result: await run(context), received };
}

const problem = (status: number, title: string) => ({ type: 'about:blank', title, status });

describe('ADMIN_SKILLS_ENDPOINTS', () => {
  it('SKL-54 lists exactly the six admin endpoints', () => {
    expect(ADMIN_SKILLS_ENDPOINTS).toEqual({
      listAdminSkills: { method: 'GET', path: '/admin/skills' },
      promoteSkill: { method: 'POST', path: '/skills/:id/promote' },
      updateSkill: { method: 'PATCH', path: '/skills/:id' },
      addSkillAlias: { method: 'POST', path: '/skills/:id/aliases' },
      updateSkillAlias: { method: 'PATCH', path: '/skills/:id/aliases/:aliasId' },
      removeSkillAlias: { method: 'DELETE', path: '/skills/:id/aliases/:aliasId' },
    });
  });

  it('SKL-54 has no function for GET /skills or POST /skills', () => {
    const endpoints = Object.values(ADMIN_SKILLS_ENDPOINTS).map((e) => `${e.method} ${e.path}`);

    expect(endpoints).not.toContain('GET /skills');
    expect(endpoints).not.toContain('POST /skills');
    expect(endpoints).toHaveLength(6);
  });

  it('SKL-54 sends each function to the method and path the table declares', async () => {
    const e = ADMIN_SKILLS_ENDPOINTS;
    const sent = [
      (await call((c) => loadAdminSkills({}, c), () => HttpResponse.json(page))).received[0],
      (await call((c) => promoteSkillById(skillId, c), () => HttpResponse.json(alfa))).received[0],
      (await call((c) => patchSkill(skillId, { name: 'Skill Fictícia Beta' }, c), () => HttpResponse.json(alfa))).received[0],
      (await call((c) => createSkillAlias(skillId, { alias: 'alfa-apelido' }, c), () => HttpResponse.json(alias, { status: 201 }))).received[0],
      (await call((c) => patchSkillAlias(skillId, aliasId, { alias: 'alfa-novo' }, c), () => HttpResponse.json(alias))).received[0],
      (await call((c) => deleteSkillAlias(skillId, aliasId, c), () => new HttpResponse(null, { status: 204 }))).received[0],
    ].map((r) => `${r?.method} ${r?.path}`);

    const fill = (path: string) => path.replace(':id', skillId).replace(':aliasId', aliasId);
    expect(sent).toEqual(
      [e.listAdminSkills, e.promoteSkill, e.updateSkill, e.addSkillAlias, e.updateSkillAlias, e.removeSkillAlias].map(
        (endpoint) => `${endpoint.method} ${fill(endpoint.path)}`,
      ),
    );
  });
});

describe('skills server functions', () => {
  it('SKL-54 listAdminSkills sends the filters it was given and parses the page', async () => {
    const { result, received } = await call(
      (c) => loadAdminSkills({ scope: 'private', category: 'database', q: 'post gres', cursor: 'abc' }, c),
      () => HttpResponse.json(page),
    );

    expect(received).toEqual([
      {
        method: 'GET',
        path: '/admin/skills?scope=private&category=database&q=post+gres&cursor=abc',
        body: undefined,
      },
    ]);
    expect(result).toEqual({ ok: true, data: page });
  });

  it('SKL-54 listAdminSkills sends no query string when no filter was given', async () => {
    const { received } = await call((c) => loadAdminSkills({}, c), () => HttpResponse.json(page));

    expect(received[0]?.path).toBe('/admin/skills');
  });

  it('SKL-54 promoteSkill posts without a body and returns the global skill', async () => {
    const { result, received } = await call((c) => promoteSkillById(skillId, c), () => HttpResponse.json(alfa));

    expect(received).toEqual([{ method: 'POST', path: `/skills/${skillId}/promote`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: alfa });
  });

  it('SKL-54 updateSkill patches the body it was given', async () => {
    const { result, received } = await call(
      (c) => patchSkill(skillId, { name: 'Skill Fictícia Beta', category: 'framework' }, c),
      () => HttpResponse.json({ ...alfa, name: 'Skill Fictícia Beta', category: 'framework' }),
    );

    expect(received).toEqual([
      { method: 'PATCH', path: `/skills/${skillId}`, body: { name: 'Skill Fictícia Beta', category: 'framework' } },
    ]);
    expect(result).toEqual({ ok: true, data: { ...alfa, name: 'Skill Fictícia Beta', category: 'framework' } });
  });

  it('SKL-54 addSkillAlias accepts both the 201 of a new alias and the 200 of an existing one', async () => {
    const created = await call(
      (c) => createSkillAlias(skillId, { alias: 'alfa-apelido' }, c),
      () => HttpResponse.json(alias, { status: 201 }),
    );
    const existing = await call(
      (c) => createSkillAlias(skillId, { alias: 'alfa-apelido' }, c),
      () => HttpResponse.json(alias, { status: 200 }),
    );

    expect(created.received).toEqual([
      { method: 'POST', path: `/skills/${skillId}/aliases`, body: { alias: 'alfa-apelido' } },
    ]);
    expect(created.result).toEqual({ ok: true, data: alias });
    expect(existing.result).toEqual({ ok: true, data: alias });
  });

  it('SKL-54 updateSkillAlias patches the alias text', async () => {
    const { result, received } = await call(
      (c) => patchSkillAlias(skillId, aliasId, { alias: 'alfa-novo' }, c),
      () => HttpResponse.json({ ...alias, alias: 'alfa-novo' }),
    );

    expect(received).toEqual([
      { method: 'PATCH', path: `/skills/${skillId}/aliases/${aliasId}`, body: { alias: 'alfa-novo' } },
    ]);
    expect(result).toEqual({ ok: true, data: { ...alias, alias: 'alfa-novo' } });
  });

  it('SKL-54 removeSkillAlias deletes and accepts the 204', async () => {
    const { result, received } = await call(
      (c) => deleteSkillAlias(skillId, aliasId, c),
      () => new HttpResponse(null, { status: 204 }),
    );

    expect(received).toEqual([{ method: 'DELETE', path: `/skills/${skillId}/aliases/${aliasId}`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('SKL-54 escapes the ids it puts in the path', async () => {
    const { received } = await call((c) => promoteSkillById('a/b?c', c), () => HttpResponse.json(alfa));

    expect(received[0]?.path).toBe('/skills/a%2Fb%3Fc/promote');
  });

  it('SKL-54 keeps the problem of a 409 so the screen can pick its own words', async () => {
    const conflict = problem(409, 'Conflict');
    const promote = await call((c) => promoteSkillById(skillId, c), () => HttpResponse.json(conflict, { status: 409 }));
    const rename = await call(
      (c) => patchSkill(skillId, { name: 'Skill Fictícia Beta' }, c),
      () => HttpResponse.json(conflict, { status: 409 }),
    );
    const addAlias = await call(
      (c) => createSkillAlias(skillId, { alias: 'beta' }, c),
      () => HttpResponse.json(conflict, { status: 409 }),
    );

    for (const { result } of [promote, rename, addAlias]) {
      expect(result).toEqual({ ok: false, status: 409, problem: conflict, retryAfterSeconds: undefined });
    }
  });

  it('SKL-54 keeps the problem of a 404 for a skill or alias that is gone', async () => {
    const missing = problem(404, 'Not Found');
    const removed = await call((c) => deleteSkillAlias(skillId, aliasId, c), () => HttpResponse.json(missing, { status: 404 }));
    const promoted = await call((c) => promoteSkillById(skillId, c), () => HttpResponse.json(missing, { status: 404 }));

    expect(removed.result).toEqual({ ok: false, status: 404, problem: missing, retryAfterSeconds: undefined });
    expect(promoted.result).toEqual({ ok: false, status: 404, problem: missing, retryAfterSeconds: undefined });
  });

  it('SKL-54 reads an api that does not answer as 503 in every function', async () => {
    const down = () => HttpResponse.error();
    const results = await Promise.all([
      call((c) => loadAdminSkills({}, c), down),
      call((c) => promoteSkillById(skillId, c), down),
      call((c) => patchSkill(skillId, { name: 'Skill Fictícia Beta' }, c), down),
      call((c) => createSkillAlias(skillId, { alias: 'beta' }, c), down),
      call((c) => patchSkillAlias(skillId, aliasId, { alias: 'beta' }, c), down),
      call((c) => deleteSkillAlias(skillId, aliasId, c), down),
    ]);

    for (const { result } of results) expect(result).toEqual({ ok: false, status: 503 });
  });

  it('SKL-54 reads a 5xx without a problem body and an off-contract 200 as 503', async () => {
    const serverError = await call((c) => loadAdminSkills({}, c), () => HttpResponse.text('boom', { status: 503 }));
    const offContract = await call((c) => loadAdminSkills({}, c), () => HttpResponse.json({ items: 'nope' }));

    expect(serverError.result).toEqual({ ok: false, status: 503 });
    expect(offContract.result).toEqual({ ok: false, status: 503 });
  });
});
