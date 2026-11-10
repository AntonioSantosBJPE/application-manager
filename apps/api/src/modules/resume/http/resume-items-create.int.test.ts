import { certificationSchema, educationSchema, experienceSchema, languageSchema, masterResumeSchema, problemDetailsSchema, projectSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const bodies = {
  experiences: { role: 'Desenvolvedora', company: 'Empresa Fictícia Alfa', location: 'Recife', startDate: '2021-03', endDate: '2023-06' },
  projects: { name: 'Projeto Fictício Alfa', url: 'https://exemplo.com/projeto', description: 'Descrição fictícia.' },
  educations: { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2015-02', endDate: '2019-12' },
  certifications: { name: 'Certificação Fictícia', issuer: 'Emissor Fictício', issuedOn: '2022-05', url: 'https://exemplo.com/certificado' },
  languages: { language: 'Inglês', level: 'advanced' },
} as const;

const schemas = {
  experiences: experienceSchema,
  projects: projectSchema,
  educations: educationSchema,
  certifications: certificationSchema,
  languages: languageSchema,
} as const;

const SECTIONS = ['experiences', 'projects', 'educations', 'certifications', 'languages'] as const;

/** 49 rows straight into a section of one user, so a test reaches the limit without 49 requests. */
const fill = (env: ResumeEnv, userId: string, count: number) =>
  query(
    env.databaseUrl,
    `insert into resume.experiences (user_id, role, company, start_date, position)
     select $1, 'Cargo Fictício', 'Empresa Fictícia ' || n, '2020-01-01', n from generate_series(1, $2::int) as n`,
    [userId, count],
  );

describe('POST /resume/:section', () => {
  it('RES-07 answers 201 with the item and puts it first in its section, for each of the five sections', async () => {
    await withResumeEnv('res_item_create', async (env) => {
      for (const section of SECTIONS) {
        const first = await call(env, env.ana, 'POST', `/resume/${section}`, bodies[section]);
        const second = await call(env, env.ana, 'POST', `/resume/${section}`, bodies[section]);

        expect(first.status, section).toBe(201);
        expect(second.status, section).toBe(201);
        const created = schemas[section].parse(await second.json());
        expect(created, section).toMatchObject(bodies[section]);
        expect(created, section).not.toHaveProperty('bullets');
        expect(created, section).not.toHaveProperty('userId');
        expect(created, section).not.toHaveProperty('position');

        const read = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());
        const ids = (read[section] as Array<{ id: string }>).map((item) => item.id);
        expect(ids, section).toHaveLength(2);
        expect(ids[0], section).toBe(created.id);
      }
    });
  });

  it('RES-07 leaves the optional fields null when the body leaves them out, and the owner is the session', async () => {
    await withResumeEnv('res_item_create_optional', async (env) => {
      const response = await call(env, env.ana, 'POST', '/resume/projects', { name: 'Projeto Fictício Beta' });

      expect(response.status).toBe(201);
      expect(projectSchema.parse(await response.json())).toMatchObject({ name: 'Projeto Fictício Beta', url: null, description: null });
      expect(await query(env.databaseUrl, 'select user_id from resume.projects')).toEqual([{ user_id: env.ana.id }]);
    });
  });

  it('RES-11 answers 400 with the invalid field and writes nothing for each refusal of the spec', async () => {
    await withResumeEnv('res_item_create_refuse', async (env) => {
      const refusals: Array<[string, string, Record<string, unknown>]> = [
        ['experiences', 'role', { ...bodies.experiences, role: '   ' }],
        ['experiences', 'company', { ...bodies.experiences, company: 'a'.repeat(161) }],
        ['experiences', 'startDate', { ...bodies.experiences, startDate: '2021-13' }],
        ['experiences', 'startDate', { ...bodies.experiences, startDate: '03/2021' }],
        ['experiences', 'endDate', { ...bodies.experiences, startDate: '2023-06', endDate: '2021-03' }],
        ['projects', 'url', { ...bodies.projects, url: 'ftp://exemplo.com/projeto' }],
        ['projects', 'name', { ...bodies.projects, name: '' }],
        ['educations', 'course', { ...bodies.educations, course: '' }],
        ['educations', 'endDate', { ...bodies.educations, startDate: '2019-12', endDate: '2015-02' }],
        ['certifications', 'url', { ...bodies.certifications, url: 'javascript:alert(1)' }],
        ['certifications', 'issuedOn', { ...bodies.certifications, issuedOn: 'maio de 2022' }],
        ['languages', 'level', { ...bodies.languages, level: 'excellent' }],
        ['languages', 'language', { ...bodies.languages, language: 'a'.repeat(61) }],
      ];

      for (const [section, field, body] of refusals) {
        const response = await call(env, env.ana, 'POST', `/resume/${section}`, body);

        expect(response.status, `${section} ${field}`).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        const problem = problemDetailsSchema.parse(await response.json());
        expect(problem.errors?.map((error) => error.path), `${section} ${field}`).toContain(field);
      }
      expect(Object.values(await resumeRowCounts(env.databaseUrl)).every((count) => count === 0)).toBe(true);
    });
  });

  it('RES-12 answers an experience and an education with no end date with endDate null', async () => {
    await withResumeEnv('res_item_create_current', async (env) => {
      const experience = await call(env, env.ana, 'POST', '/resume/experiences', { ...bodies.experiences, endDate: undefined });
      const education = await call(env, env.ana, 'POST', '/resume/educations', { ...bodies.educations, endDate: null });

      expect(experienceSchema.parse(await experience.json()).endDate).toBeNull();
      expect(educationSchema.parse(await education.json()).endDate).toBeNull();
      const read = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());
      expect(read.experiences[0]!.endDate).toBeNull();
      expect(read.educations[0]!.endDate).toBeNull();
    });
  });

  it('RES-13 answers 422 in Problem Details on the 51st item of a section and writes nothing', async () => {
    await withResumeEnv('res_item_create_limit', async (env) => {
      await fill(env, env.ana.id, 50);

      const response = await call(env, env.ana, 'POST', '/resume/experiences', bodies.experiences);

      expect(response.status).toBe(422);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(problemDetailsSchema.parse(await response.json()).status).toBe(422);
      expect((await resumeRowCounts(env.databaseUrl)).experiences).toBe(50);
      // The limit is per section and per person.
      expect((await call(env, env.ana, 'POST', '/resume/projects', bodies.projects)).status).toBe(201);
      expect((await call(env, env.bruno, 'POST', '/resume/experiences', bodies.experiences)).status).toBe(201);
    });
  });

  it('RES-13 ends with 50 items, one 201 and one 422, when two creations arrive together with 49', async () => {
    await withResumeEnv('res_item_create_race', async (env) => {
      await fill(env, env.ana.id, 49);

      const responses = await Promise.all([
        call(env, env.ana, 'POST', '/resume/experiences', bodies.experiences),
        call(env, env.ana, 'POST', '/resume/experiences', bodies.experiences),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
      expect((await resumeRowCounts(env.databaseUrl)).experiences).toBe(50);
    });
  });

  it('RES-07 answers 404 for a section that does not exist, before the body is read, and writes nothing', async () => {
    await withResumeEnv('res_item_create_section', async (env) => {
      for (const segment of ['skills', 'bullets', 'profile-x', 'EXPERIENCES']) {
        const response = await call(env, env.ana, 'POST', `/resume/${segment}`, { nonsense: true });

        expect(response.status, segment).toBe(404);
        expect(problemDetailsSchema.parse(await response.json()).status, segment).toBe(404);
      }
      expect(Object.values(await resumeRowCounts(env.databaseUrl)).every((count) => count === 0)).toBe(true);
    });
  });
});
