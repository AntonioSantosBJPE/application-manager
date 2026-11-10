import { bulletResponseSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, seedBullet, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';
import { ResumeController } from './resume.controller.js';

const SECTIONS = ['experiences', 'projects', 'educations', 'certifications', 'languages'] as const;
const BULLET_SECTIONS = ['experiences', 'projects'] as const;

/** Valid bodies, so a refusal is about access and never about the shape of the request. */
const createBodies: Record<(typeof SECTIONS)[number], Record<string, unknown>> = {
  experiences: { role: 'Cargo Fictício', company: 'Empresa Fictícia Alfa', startDate: '2021-03' },
  projects: { name: 'Projeto Fictício Alfa' },
  educations: { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2015-02' },
  certifications: { name: 'Certificação Fictícia' },
  languages: { language: 'Inglês', level: 'basic' },
};
const updateBodies: Record<(typeof SECTIONS)[number], Record<string, unknown>> = {
  experiences: { company: 'Empresa Fictícia Alterada' },
  projects: { name: 'Projeto Fictício Alterado' },
  educations: { course: 'Curso Fictício Alterado' },
  certifications: { name: 'Certificação Fictícia Alterada' },
  languages: { level: 'fluent' },
};
const profileBody = {
  fullName: 'Pessoa Fictícia Alfa',
  headline: 'Engenheira de Software',
  email: 'alfa@exemplo.com',
  phone: null,
  location: null,
  links: [],
  summary: 'Resumo fictício.',
  locale: 'pt-BR',
};

/** What an account of the test holds, so a route can be aimed at each of its resources. */
interface Fixture {
  items: Record<(typeof SECTIONS)[number], string>;
  /** The bullet of each section that owns bullets, and the item it hangs from. */
  bullets: Record<(typeof BULLET_SECTIONS)[number], string>;
}

interface RouteCase {
  /** As the controller declares it: `POST /resume/:section`. */
  name: string;
  method: string;
  path: string;
  body?: unknown;
  /** What another member gets when the route names the resource of the first one: `404` for an id in the path, `400` for an id in the list. */
  cross?: 404 | 400;
}

/** Every route of `/resume`, once for each section it takes, aimed at the resources of `fixture`. */
function routesFor(fixture: Fixture): RouteCase[] {
  const cases: RouteCase[] = [
    { name: 'GET /resume', method: 'GET', path: '/resume' },
    { name: 'GET /resume/summary', method: 'GET', path: '/resume/summary' },
    { name: 'PUT /resume/profile', method: 'PUT', path: '/resume/profile', body: profileBody },
  ];
  for (const section of SECTIONS) {
    const id = fixture.items[section];
    cases.push(
      { name: 'POST /resume/:section', method: 'POST', path: `/resume/${section}`, body: createBodies[section] },
      { name: 'PATCH /resume/:section/:id', method: 'PATCH', path: `/resume/${section}/${id}`, body: updateBodies[section], cross: 404 },
      { name: 'PUT /resume/:section/order', method: 'PUT', path: `/resume/${section}/order`, body: { ids: [id] }, cross: 400 },
      { name: 'DELETE /resume/:section/:id', method: 'DELETE', path: `/resume/${section}/${id}`, cross: 404 },
    );
  }
  for (const section of BULLET_SECTIONS) {
    const id = fixture.items[section];
    const bullet = fixture.bullets[section];
    cases.push(
      { name: 'POST /resume/:section/:id/bullets', method: 'POST', path: `/resume/${section}/${id}/bullets`, body: { text: 'Bullet fictício.', skillIds: [] }, cross: 404 },
      { name: 'PATCH /resume/:section/:id/bullets/:bulletId', method: 'PATCH', path: `/resume/${section}/${id}/bullets/${bullet}`, body: { text: 'Bullet alterado.' }, cross: 404 },
      { name: 'PUT /resume/:section/:id/bullets/order', method: 'PUT', path: `/resume/${section}/${id}/bullets/order`, body: { ids: [bullet] }, cross: 404 },
      { name: 'DELETE /resume/:section/:id/bullets/:bulletId', method: 'DELETE', path: `/resume/${section}/${id}/bullets/${bullet}`, cross: 404 },
    );
  }
  return cases;
}

/** Every row of the seven tables, so "changes nothing" is a comparison of the whole state and not of a field. */
const snapshot = async (env: ResumeEnv) => {
  const tables: Record<string, unknown[]> = {};
  for (const table of ['profiles', 'experiences', 'projects', 'educations', 'certifications', 'languages', 'bullets']) {
    tables[table] = await query(env.databaseUrl, `select to_jsonb(t) as row from resume.${table} t order by id`);
  }
  return tables;
};

/** A profile, one item of every section and a bullet on each experience and project: a stray write has something to change. */
async function fill(env: ResumeEnv, account: ResumeEnv['ana']): Promise<Fixture> {
  expect((await call(env, account, 'PUT', '/resume/profile', profileBody)).status).toBe(200);
  const items = {} as Fixture['items'];
  for (const section of SECTIONS) {
    const created = await call(env, account, 'POST', `/resume/${section}`, createBodies[section]);
    expect(created.status, section).toBe(201);
    items[section] = ((await created.json()) as { id: string }).id;
  }
  const bullets = {} as Fixture['bullets'];
  for (const section of BULLET_SECTIONS) {
    const created = await call(env, account, 'POST', `/resume/${section}/${items[section]}/bullets`, { text: 'Bullet fictício original.', skillIds: [] });
    bullets[section] = bulletResponseSchema.parse(await created.json()).bullet.id;
  }
  return { items, bullets };
}

describe('the access to /resume', () => {
  it('RES-29 declares access on every route of the controller: a member only, and the sweep below covers exactly those routes', () => {
    const registered: string[] = [];
    for (const name of Object.getOwnPropertyNames(ResumeController.prototype)) {
      const handler = (ResumeController.prototype as unknown as Record<string, unknown>)[name] as object;
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      const method = Reflect.getMetadata('method', handler) as number | undefined;
      if (path === undefined || method === undefined) continue;
      const verb = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][method];
      registered.push(`${verb} /resume${path === '/' ? '' : `/${path}`}`);
      // The key identity writes its declarations under; the route architecture test of AD-006 reads the same one on the whole application.
      expect(Reflect.getMetadata('identity:access', handler), `${verb} ${path}`).toEqual({ kind: 'roles', roles: ['member'] });
    }
    const swept = routesFor({ items: { experiences: 'x', projects: 'x', educations: 'x', certifications: 'x', languages: 'x' }, bullets: { experiences: 'x', projects: 'x' } });

    expect(registered.sort()).toEqual([...new Set(swept.map((route) => route.name))].sort());
  });

  it('RES-29 answers 401 on every route, for every section, without a session, and changes nothing', async () => {
    await withResumeEnv('res_access_401', async (env) => {
      const fixture = await fill(env, env.ana);
      const before = await snapshot(env);

      for (const route of routesFor(fixture)) {
        const response = await call(env, undefined, route.method, route.path, route.body);

        expect(response.status, `${route.method} ${route.path}`).toBe(401);
        expect(response.headers.get('content-type'), route.name).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(401);
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('RES-30 answers 403 on every route, for every section, to an admin, and changes nothing', async () => {
    await withResumeEnv('res_access_403', async (env) => {
      const fixture = await fill(env, env.ana);
      const before = await snapshot(env);

      for (const route of routesFor(fixture)) {
        const response = await call(env, env.admin, route.method, route.path, route.body);

        expect(response.status, `${route.method} ${route.path}`).toBe(403);
        expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(403);
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('RES-28 answers another member 404 on every route that names a resource of the first, and changes none of the seven tables', async () => {
    await withResumeEnv('res_access_404', async (env) => {
      const anas = await fill(env, env.ana);
      const brunos = await fill(env, env.bruno);
      const before = await snapshot(env);

      for (const [owner, ids] of [
        [env.bruno, anas],
        [env.ana, brunos],
      ] as const) {
        for (const route of routesFor(ids).filter((candidate) => candidate.cross !== undefined)) {
          const response = await call(env, owner, route.method, route.path, route.body);

          expect(response.status, `${route.method} ${route.path} by ${owner.email}`).toBe(route.cross);
          expect(response.headers.get('content-type'), route.name).toContain('application/problem+json');
          expect(problemDetailsSchema.parse(await response.json()).status, route.name).toBe(route.cross);
        }
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('RES-28 answers 404 on every route that names a resource for an id that does not exist or is not a uuid', async () => {
    await withResumeEnv('res_access_unknown', async (env) => {
      await fill(env, env.ana);
      const before = await snapshot(env);

      for (const id of ['0195f3a0-0000-7000-8000-00000000dead', 'not-a-uuid', '123']) {
        const aimed: Fixture = {
          items: { experiences: id, projects: id, educations: id, certifications: id, languages: id },
          bullets: { experiences: id, projects: id },
        };
        for (const route of routesFor(aimed).filter((candidate) => candidate.cross === 404)) {
          const response = await call(env, env.ana, route.method, route.path, route.body);

          expect(response.status, `${route.method} ${route.path}`).toBe(404);
          expect(problemDetailsSchema.parse(await response.json()).status).toBe(404);
        }
      }
      expect(await snapshot(env)).toEqual(before);
    });
  });

  it('RES-28 shows another member nothing of the first in GET /resume and GET /resume/summary', async () => {
    await withResumeEnv('res_access_isolation', async (env) => {
      await fill(env, env.ana);

      const read = (await (await call(env, env.bruno, 'GET', '/resume')).json()) as Record<string, unknown>;
      const summary = await (await call(env, env.bruno, 'GET', '/resume/summary')).json();

      expect(read).toEqual({
        profile: { fullName: '', headline: '', email: '', phone: null, location: null, links: [], summary: '', locale: 'pt-BR' },
        experiences: [],
        projects: [],
        educations: [],
        certifications: [],
        languages: [],
        skills: {},
      });
      expect(summary).toEqual({ ready: false });
    });
  });

  it('RES-28 ignores a userId in the body of every write and writes the rows for the session', async () => {
    await withResumeEnv('res_access_userid', async (env) => {
      const stray = { userId: env.bruno.id, user_id: env.bruno.id };
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      const bullet = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience });
      const secondExperience = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });

      const profile = await call(env, env.ana, 'PUT', '/resume/profile', { ...profileBody, ...stray });
      const statuses = [profile.status];
      for (const section of SECTIONS) statuses.push((await call(env, env.ana, 'POST', `/resume/${section}`, { ...createBodies[section], ...stray })).status);
      statuses.push((await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}`, { ...updateBodies.experiences, ...stray })).status);
      statuses.push((await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício novo.', skillIds: [], ...stray })).status);
      statuses.push((await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, { text: 'Bullet alterado.', ...stray })).status);
      const saved = (await (await call(env, env.ana, 'GET', '/resume')).json()) as { experiences: Array<{ id: string }> };
      expect(saved.experiences.map((item) => item.id)).toEqual(expect.arrayContaining([experience, secondExperience]));
      statuses.push((await call(env, env.ana, 'PUT', '/resume/experiences/order', { ids: saved.experiences.map((item) => item.id).reverse(), ...stray })).status);

      expect(statuses).toEqual([200, 201, 201, 201, 201, 201, 200, 201, 200, 200]);
      for (const table of ['profiles', 'experiences', 'projects', 'educations', 'certifications', 'languages', 'bullets']) {
        const owners = await query<{ user_id: string }>(env.databaseUrl, `select distinct user_id from resume.${table}`);
        expect(owners, table).toEqual([{ user_id: env.ana.id }]);
      }
    });
  });
});
