import { applicationDetailSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { type TestAccount } from '../../../../test/accounts.js';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';
import { ApplicationsController } from './applications.controller.js';

/** Every route of `/applications`, each with a valid body, so a refusal is about access and never about the shape of the request. */
interface RouteCase {
  name: string;
  method: string;
  path: (id: string) => string;
  body?: unknown;
  /** The route works on one application named in the path; another person's id answers `404`. */
  byId: boolean;
}

const routes: RouteCase[] = [
  { name: 'POST /applications', method: 'POST', path: () => '/applications', body: applicationBody(), byId: false },
  { name: 'GET /applications', method: 'GET', path: () => '/applications', byId: false },
  { name: 'GET /applications/count', method: 'GET', path: () => '/applications/count', byId: false },
  { name: 'GET /applications/:id', method: 'GET', path: (id) => `/applications/${id}`, byId: true },
  { name: 'PATCH /applications/:id/job-posting', method: 'PATCH', path: (id) => `/applications/${id}/job-posting`, body: { title: 'Título Alterado' }, byId: true },
  { name: 'PUT /applications/:id/skills', method: 'PUT', path: (id) => `/applications/${id}/skills`, body: [], byId: true },
  { name: 'POST /applications/:id/status', method: 'POST', path: (id) => `/applications/${id}/status`, body: { status: 'offer' }, byId: true },
  { name: 'POST /applications/:id/events', method: 'POST', path: (id) => `/applications/${id}/events`, body: { kind: 'note', note: 'Nota fictícia.' }, byId: true },
  { name: 'POST /applications/:id/ghost-snooze', method: 'POST', path: (id) => `/applications/${id}/ghost-snooze`, byId: true },
  { name: 'DELETE /applications/:id', method: 'DELETE', path: (id) => `/applications/${id}`, byId: true },
];

/** Every row of the four tables, so "changes nothing" is a comparison of the whole state and not of a field. */
const snapshot = async (env: ApplicationsEnv) => {
  const tables: Record<string, unknown[]> = {};
  for (const [table, order] of [
    ['job_postings', 'id'],
    ['job_posting_skills', 'job_posting_id, skill_id'],
    ['applications', 'id'],
    ['application_events', 'id'],
  ] as const) {
    tables[table] = await query(env.databaseUrl, `select to_jsonb(t) as row from applications.${table} t order by ${order}`);
  }
  return tables;
};

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

/** An application with a skill and a stage and a note, so a stray write has something to change. */
const createFull = async (env: ApplicationsEnv, account: TestAccount) => {
  const node = await globalSkillId(env, 'nodejs');
  const created = applicationDetailSchema.parse(
    await (await call(env, account, 'POST', '/applications', applicationBody({}, { status: 'applied', skills: [{ skillId: node, requirement: 'required' }] }))).json(),
  );
  await call(env, account, 'POST', `/applications/${created.id}/events`, { kind: 'stage', stage: 'hr' });
  return created.id;
};

describe('the access to /applications', () => {
  it('APP-40 declares access on every route of the controller: a member only, and the sweep below covers exactly those routes', () => {
    const registered: string[] = [];
    for (const name of Object.getOwnPropertyNames(ApplicationsController.prototype)) {
      const handler = (ApplicationsController.prototype as unknown as Record<string, unknown>)[name] as object;
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      const method = Reflect.getMetadata('method', handler) as number | undefined;
      if (path === undefined || method === undefined) continue;
      const verb = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][method];
      registered.push(`${verb} /applications${path === '/' ? '' : `/${path}`}`);
      // The key identity writes its declarations under; the route architecture test of AD-006 reads the same one on the whole application.
      expect(Reflect.getMetadata('identity:access', handler), `${verb} ${path}`).toEqual({ kind: 'roles', roles: ['member'] });
    }

    expect(registered.sort()).toEqual(routes.map((route) => route.name).sort());
  });

  it('APP-39 answers 401 on every route without a session and changes nothing', async () => {
    await withApplicationsEnv('app_access_401', async (env) => {
      const id = await createFull(env, env.ana);
      const before = await snapshot(env);

      for (const route of routes) {
        const response = await call(env, undefined, route.method, route.path(id), route.body);

        expect(response.status, route.name).toBe(401);
        expect(response.headers.get('content-type'), route.name).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(401);
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('APP-38 answers 403 on every route to an admin and changes nothing', async () => {
    await withApplicationsEnv('app_access_403', async (env) => {
      const id = await createFull(env, env.ana);
      const before = await snapshot(env);

      for (const route of routes) {
        const response = await call(env, env.admin, route.method, route.path(id), route.body);

        expect(response.status, route.name).toBe(403);
        expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(403);
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('APP-19 answers 404 to another member on every route of an application and changes nothing, for either of them', async () => {
    await withApplicationsEnv('app_access_404', async (env) => {
      const anas = await createFull(env, env.ana);
      const brunos = await createFull(env, env.bruno);
      const before = await snapshot(env);

      for (const route of routes.filter((candidate) => candidate.byId)) {
        for (const [owner, id] of [
          [env.bruno, anas],
          [env.ana, brunos],
        ] as const) {
          const response = await call(env, owner, route.method, route.path(id), route.body);

          expect(response.status, `${route.name} by ${owner.email}`).toBe(404);
          expect(response.headers.get('content-type'), route.name).toContain('application/problem+json');
          expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(404);
        }
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('APP-19 answers 404 on every route of an application for an id that does not exist or is not a uuid', async () => {
    await withApplicationsEnv('app_access_unknown', async (env) => {
      await createFull(env, env.ana);
      const before = await snapshot(env);

      for (const route of routes.filter((candidate) => candidate.byId)) {
        for (const id of ['0195f3a0-0000-7000-8000-00000000dead', 'not-a-uuid', '123']) {
          const response = await call(env, env.ana, route.method, route.path(id), route.body);

          expect(response.status, `${route.name} with ${id}`).toBe(404);
          expect(problemDetailsSchema.parse(await response.json()).status, `${route.name} with ${id}`).toBe(404);
        }
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('APP-19 does not leak the other person: the list, the count and a search show only the own applications', async () => {
    await withApplicationsEnv('app_access_isolation', async (env) => {
      await createFull(env, env.ana);
      await createFull(env, env.bruno);
      await createFull(env, env.bruno);

      const count = (await (await call(env, env.ana, 'GET', '/applications/count')).json()) as { total: number };
      const page = (await (await call(env, env.ana, 'GET', '/applications')).json()) as { items: unknown[] };

      expect(count.total).toBe(1);
      expect(page.items).toHaveLength(1);
    });
  });
});
