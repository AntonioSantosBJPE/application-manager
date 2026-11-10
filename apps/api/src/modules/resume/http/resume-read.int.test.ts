import { masterResumeSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { call, resumeRowCounts, seedExperience, withResumeEnv } from '../../../../test/resume.js';

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
});
