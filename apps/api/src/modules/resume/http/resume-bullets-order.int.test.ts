import { masterResumeSchema, orderResponseSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, seedBullet, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const positions = (env: ResumeEnv) => query<{ id: string; position: number }>(env.databaseUrl, 'select id, position from resume.bullets order by position, id');

const bulletIdsOf = async (env: ResumeEnv, section: 'experiences' | 'projects' = 'experiences') =>
  masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json())[section][0]!.bullets.map((bullet) => bullet.id);

/** An experience of Ana with three bullets saved in a messy order on purpose: positions that are not 0..2. */
const seedThree = async (env: ResumeEnv) => {
  const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
  const a = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Bullet fictício alfa.', position: -2 });
  const b = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Bullet fictício beta.', position: 4 });
  const c = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Bullet fictício gama.', position: 8 });
  return { experience, ids: [a, b, c] as const };
};

describe('PUT /resume/:section/:id/bullets/order', () => {
  it('RES-26 reverses three bullets, answers { ids } in the new order and GET /resume shows it, renumbered 0..2', async () => {
    await withResumeEnv('res_bullets_order', async (env) => {
      const { experience, ids } = await seedThree(env);
      const [a, b, c] = ids;

      const response = await call(env, env.ana, 'PUT', `/resume/experiences/${experience}/bullets/order`, { ids: [c, b, a] });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(orderResponseSchema.parse(body)).toEqual({ ids: [c, b, a] });
      expect(Object.keys(body as object)).toEqual(['ids']);
      expect(await bulletIdsOf(env)).toEqual([c, b, a]);
      expect((await positions(env)).map((row) => row.position)).toEqual([0, 1, 2]);
    });
  });

  it('RES-26 orders the bullets of a project and leaves the bullets of another item alone', async () => {
    await withResumeEnv('res_bullets_order_project', async (env) => {
      const project = (await query<{ id: string }>(env.databaseUrl, "insert into resume.projects (user_id, name, position) values ($1, 'Projeto Fictício', 0) returning id", [env.ana.id]))[0]!.id;
      const inserted = await query<{ id: string }>(
        env.databaseUrl,
        "insert into resume.bullets (user_id, project_id, text, position) values ($1, $2, 'Um.', 0), ($1, $2, 'Dois.', 1) returning id",
        [env.ana.id, project],
      );
      const saved = inserted.map((row) => row.id);
      const reversed = [...saved].reverse();
      const { ids: untouched } = await seedThree(env);
      const before = await positions(env);

      const response = await call(env, env.ana, 'PUT', `/resume/projects/${project}/bullets/order`, { ids: reversed });

      expect(orderResponseSchema.parse(await response.json()).ids).toEqual(reversed);
      expect((await positions(env)).filter((row) => untouched.includes(row.id as (typeof untouched)[number]))).toEqual(before.filter((row) => untouched.includes(row.id as (typeof untouched)[number])));
      expect(await bulletIdsOf(env, 'projects')).toEqual(reversed);
    });
  });

  it('RES-27 answers 400 and keeps the order for a bullet of another item, one missing, repeated, of another account or not a uuid', async () => {
    await withResumeEnv('res_bullets_order_refuse', async (env) => {
      const { experience, ids } = await seedThree(env);
      const [a, b, c] = ids;
      const other = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });
      const ofOther = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: other });
      const brunosExperience = await seedExperience(env.databaseUrl, { userId: env.bruno.id });
      const brunos = await seedBullet(env.databaseUrl, { userId: env.bruno.id, experienceId: brunosExperience });
      const before = await positions(env);

      const refusals: Array<[string, unknown]> = [
        ['bullet of another item', { ids: [c, b, ofOther] }],
        ['missing', { ids: [c, b] }],
        ['repeated', { ids: [c, b, b] }],
        ['one more', { ids: [a, b, c, ofOther] }],
        ['of another account', { ids: [c, b, brunos] }],
        ['not a uuid', { ids: [c, b, 'not-a-uuid'] }],
        ['empty', { ids: [] }],
      ];
      for (const [name, body] of refusals) {
        const response = await call(env, env.ana, 'PUT', `/resume/experiences/${experience}/bullets/order`, body);

        expect(response.status, name).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, name).toBe(400);
      }
      expect(await positions(env)).toEqual(before);
    });
  });

  it('RES-27 answers 404, and writes nothing, for an item of another account, one that does not exist, one that is not a uuid and a section with no bullets', async () => {
    await withResumeEnv('res_bullets_order_404', async (env) => {
      const { experience, ids } = await seedThree(env);
      const brunosExperience = await seedExperience(env.databaseUrl, { userId: env.bruno.id });
      const before = await positions(env);
      const body = { ids: [...ids].reverse() };

      for (const path of [
        `/resume/experiences/${brunosExperience}/bullets/order`,
        '/resume/experiences/0195f3a0-0000-7000-8000-00000000dead/bullets/order',
        '/resume/experiences/not-a-uuid/bullets/order',
        `/resume/projects/${experience}/bullets/order`,
        `/resume/educations/${experience}/bullets/order`,
        `/resume/skills/${experience}/bullets/order`,
      ]) {
        const response = await call(env, env.ana, 'PUT', path, body);

        expect(response.status, path).toBe(404);
        expect(problemDetailsSchema.parse(await response.json()).status, path).toBe(404);
      }
      expect(await positions(env)).toEqual(before);
    });
  });
});
