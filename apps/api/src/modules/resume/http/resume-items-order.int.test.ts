import { masterResumeSchema, orderResponseSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const positions = (env: ResumeEnv) =>
  query<{ id: string; position: number }>(env.databaseUrl, 'select id, position from resume.experiences order by position, id');

const order = async (env: ResumeEnv, section = 'experiences') =>
  masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json())[section as 'experiences'].map((item) => item.id);

/** Three experiences of Ana, saved in a messy order on purpose: positions that are not 0..2. */
const seedThree = async (env: ResumeEnv) => {
  const a = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Alfa', position: -4 });
  const b = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 3 });
  const c = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Gama', position: 9 });
  return [a, b, c] as const;
};

describe('PUT /resume/:section/order', () => {
  it('RES-25 reverses three experiences, answers { ids } in the new order and GET /resume shows it, renumbered 0..2', async () => {
    await withResumeEnv('res_items_order', async (env) => {
      const [a, b, c] = await seedThree(env);

      const response = await call(env, env.ana, 'PUT', '/resume/experiences/order', { ids: [c, b, a] });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(orderResponseSchema.parse(body)).toEqual({ ids: [c, b, a] });
      expect(Object.keys(body as object)).toEqual(['ids']);
      expect(await order(env)).toEqual([c, b, a]);
      expect((await positions(env)).map((row) => row.position)).toEqual([0, 1, 2]);
    });
  });

  it('RES-25 orders the other sections the same way and leaves the order of another account alone', async () => {
    await withResumeEnv('res_items_order_sections', async (env) => {
      const ids: string[] = [];
      for (const name of ['Projeto Fictício Alfa', 'Projeto Fictício Beta']) {
        ids.push(((await (await call(env, env.ana, 'POST', '/resume/projects', { name })).json()) as { id: string }).id);
      }
      const brunos = await seedExperience(env.databaseUrl, { userId: env.bruno.id, position: 7 });

      const response = await call(env, env.ana, 'PUT', '/resume/projects/order', { ids });

      expect(orderResponseSchema.parse(await response.json())).toEqual({ ids });
      expect(await order(env, 'projects')).toEqual(ids);
      expect(await positions(env)).toEqual([{ id: brunos, position: 7 }]);
    });
  });

  it('RES-27 answers 400 and keeps the order for an id missing, repeated, of another section, of another account or not a uuid', async () => {
    await withResumeEnv('res_items_order_refuse', async (env) => {
      const [a, b, c] = await seedThree(env);
      const project = ((await (await call(env, env.ana, 'POST', '/resume/projects', { name: 'Projeto Fictício Alfa' })).json()) as { id: string }).id;
      const brunos = await seedExperience(env.databaseUrl, { userId: env.bruno.id });
      const before = await positions(env);

      const refusals: Array<[string, unknown]> = [
        ['missing', { ids: [c, b] }],
        ['repeated', { ids: [c, b, b] }],
        ['repeated and missing', { ids: [a, a, a] }],
        ['of another section', { ids: [c, b, project] }],
        ['of another account', { ids: [c, b, brunos] }],
        ['one more of another account', { ids: [a, b, c, brunos] }],
        ['not a uuid', { ids: [c, b, 'not-a-uuid'] }],
        ['empty', { ids: [] }],
        ['without ids', {}],
      ];
      for (const [name, body] of refusals) {
        const response = await call(env, env.ana, 'PUT', '/resume/experiences/order', body);

        expect(response.status, name).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, name).toBe(400);
      }
      expect(await positions(env)).toEqual(before);
    });
  });

  it('RES-25 accepts an empty list for a section with no item, and answers 404 for a section that does not exist', async () => {
    await withResumeEnv('res_items_order_empty', async (env) => {
      const empty = await call(env, env.ana, 'PUT', '/resume/languages/order', { ids: [] });
      const unknown = await call(env, env.ana, 'PUT', '/resume/skills/order', { ids: [] });

      expect(orderResponseSchema.parse(await empty.json())).toEqual({ ids: [] });
      expect(unknown.status).toBe(404);
    });
  });
});
