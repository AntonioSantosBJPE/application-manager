import { masterResumeSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, seedBullet, seedExperience, withResumeEnv } from '../../../../test/resume.js';

describe('GET /resume', () => {
  it('RES-01 answers a new account the empty profile in pt-BR, the five empty sections and no skills, and writes no row', async () => {
    await withResumeEnv('res_read_empty', async (env) => {
      const before = await resumeRowCounts(env.databaseUrl);

      const response = await call(env, env.ana, 'GET', '/resume');

      expect(response.status).toBe(200);
      expect(masterResumeSchema.parse(await response.json())).toEqual({
        profile: { fullName: '', headline: '', email: '', phone: null, location: null, links: [], summary: '', locale: 'pt-BR' },
        experiences: [],
        projects: [],
        educations: [],
        certifications: [],
        languages: [],
        skills: {},
      });
      expect(await resumeRowCounts(env.databaseUrl)).toEqual(before);
      expect(Object.values(before).every((count) => count === 0)).toBe(true);
    });
  });

  it('RES-02 answers the items of a section in the order of position, with the dates as YYYY-MM and a null end for the current one', async () => {
    await withResumeEnv('res_read_order', async (env) => {
      await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', startDate: '2019-02-01', endDate: '2020-12-01', position: 5 });
      await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Alfa', startDate: '2021-01-01', endDate: null, position: -1 });
      await seedExperience(env.databaseUrl, { userId: env.bruno.id, company: 'Empresa Fictícia Gama', position: 0 });

      const body = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());

      expect(body.experiences.map(({ company, startDate, endDate, bullets }) => ({ company, startDate, endDate, bullets }))).toEqual([
        { company: 'Empresa Fictícia Alfa', startDate: '2021-01', endDate: null, bullets: [] },
        { company: 'Empresa Fictícia Beta', startDate: '2019-02', endDate: '2020-12', bullets: [] },
      ]);
    });
  });

  it('RES-02 answers every section in the order of position and describes each skill cited once, with its name and scope', async () => {
    await withResumeEnv('res_read_order_all', async (env) => {
      const node = (await query<{ id: string }>(env.databaseUrl, "select id from skills.skills where normalized_key = 'nodejs' and owner_user_id is null"))[0]!.id;
      const own = skillSchema.parse(await (await call(env, env.ana, 'POST', '/skills', { name: 'Skill Fictícia Alfa', category: 'tool' })).json());
      // Saved out of order: the position decides, not the order of the insert.
      const positions: Array<[string, number]> = [['C', 5], ['A', -2], ['B', 9]];
      const ids = { projects: [] as string[], experiences: [] as string[] };
      for (const [mark, position] of positions) {
        ids.experiences.push(await seedExperience(env.databaseUrl, { userId: env.ana.id, company: `Empresa ${mark}`, position }));
        ids.projects.push(
          (await query<{ id: string }>(env.databaseUrl, 'insert into resume.projects (user_id, name, position) values ($1, $2, $3) returning id', [env.ana.id, `Projeto ${mark}`, position]))[0]!.id,
        );
        await query(env.databaseUrl, "insert into resume.educations (user_id, course, institution, start_date, position) values ($1, $2, 'Instituição Fictícia', '2015-02-01', $3)", [env.ana.id, `Curso ${mark}`, position]);
        await query(env.databaseUrl, 'insert into resume.certifications (user_id, name, position) values ($1, $2, $3)', [env.ana.id, `Certificação ${mark}`, position]);
        await query(env.databaseUrl, "insert into resume.languages (user_id, language, level, position) values ($1, $2, 'basic', $3)", [env.ana.id, `Idioma ${mark}`, position]);
      }
      // The same skill cited by several bullets of both parents.
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: ids.experiences[0]!, skillIds: [node, own.id], position: 0 });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: ids.experiences[1]!, skillIds: [node], position: 0 });
      await query(env.databaseUrl, "insert into resume.bullets (user_id, project_id, text, skill_ids, position) values ($1, $2, 'Bullet fictício.', $3, 0)", [env.ana.id, ids.projects[0], [node]]);

      const body = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());

      expect(body.experiences.map((item) => item.company)).toEqual(['Empresa A', 'Empresa C', 'Empresa B']);
      expect(body.projects.map((item) => item.name)).toEqual(['Projeto A', 'Projeto C', 'Projeto B']);
      expect(body.educations.map((item) => item.course)).toEqual(['Curso A', 'Curso C', 'Curso B']);
      expect(body.certifications.map((item) => item.name)).toEqual(['Certificação A', 'Certificação C', 'Certificação B']);
      expect(body.languages.map((item) => item.language)).toEqual(['Idioma A', 'Idioma C', 'Idioma B']);
      expect(Object.keys(body.skills).sort()).toEqual([node, own.id].sort());
      expect(body.skills[node]).toEqual({ name: 'Node.js', scope: 'global' });
      expect(body.skills[own.id]).toEqual({ name: 'Skill Fictícia Alfa', scope: 'private' });
    });
  });
});
