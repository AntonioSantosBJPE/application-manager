import { certificationSchema, experienceSchema, languageSchema, problemDetailsSchema, projectSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const rows = (env: ResumeEnv, table: string) => query(env.databaseUrl, `select to_jsonb(t) as row from resume.${table} t order by id`);

const createExperience = async (env: ResumeEnv) => {
  const response = await call(env, env.ana, 'POST', '/resume/experiences', {
    role: 'Desenvolvedora',
    company: 'Empresa Fictícia Alfa',
    location: 'Recife',
    startDate: '2021-03',
    endDate: '2023-06',
  });
  return experienceSchema.parse(await response.json());
};

describe('PATCH /resume/:section/:id', () => {
  it('RES-08 writes only the field sent, answers 200 with the item without bullets and leaves the others as they were', async () => {
    await withResumeEnv('res_item_update', async (env) => {
      const created = await createExperience(env);

      const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, { company: '  Empresa Fictícia Beta  ' });

      expect(response.status).toBe(200);
      const body = experienceSchema.parse(await response.json());
      expect(body).toEqual({ ...created, company: 'Empresa Fictícia Beta' });
      expect(body).not.toHaveProperty('bullets');
      expect(await query(env.databaseUrl, 'select role, company, location, start_date::text, end_date::text from resume.experiences')).toEqual([
        { role: 'Desenvolvedora', company: 'Empresa Fictícia Beta', location: 'Recife', start_date: '2021-03-01', end_date: '2023-06-01' },
      ]);
    });
  });

  it('RES-08 makes an experience current with endDate null and clears an optional field with null', async () => {
    await withResumeEnv('res_item_update_null', async (env) => {
      const created = await createExperience(env);

      const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, { endDate: null, location: null });

      expect(experienceSchema.parse(await response.json())).toEqual({ ...created, endDate: null, location: null });
    });
  });

  it('RES-08 edits an item of each of the other sections and keeps its place in the section', async () => {
    await withResumeEnv('res_item_update_sections', async (env) => {
      const project = projectSchema.parse(await (await call(env, env.ana, 'POST', '/resume/projects', { name: 'Projeto Fictício Alfa' })).json());
      await call(env, env.ana, 'POST', '/resume/projects', { name: 'Projeto Fictício Beta' });
      const certification = certificationSchema.parse(await (await call(env, env.ana, 'POST', '/resume/certifications', { name: 'Certificação Fictícia' })).json());
      const language = languageSchema.parse(await (await call(env, env.ana, 'POST', '/resume/languages', { language: 'Inglês', level: 'basic' })).json());

      const edited = await call(env, env.ana, 'PATCH', `/resume/projects/${project.id}`, { url: 'https://exemplo.com/projeto' });
      const issued = await call(env, env.ana, 'PATCH', `/resume/certifications/${certification.id}`, { issuedOn: '2022-05' });
      const level = await call(env, env.ana, 'PATCH', `/resume/languages/${language.id}`, { level: 'fluent' });

      expect(projectSchema.parse(await edited.json())).toEqual({ ...project, url: 'https://exemplo.com/projeto' });
      expect(certificationSchema.parse(await issued.json()).issuedOn).toBe('2022-05');
      expect(languageSchema.parse(await level.json()).level).toBe('fluent');
      expect((await query<{ name: string }>(env.databaseUrl, 'select name from resume.projects order by position, id')).map((row) => row.name)).toEqual([
        'Projeto Fictício Beta',
        'Projeto Fictício Alfa',
      ]);
    });
  });

  it('RES-11 answers 400 with the invalid field and writes nothing for an invalid body', async () => {
    await withResumeEnv('res_item_update_refuse', async (env) => {
      const created = await createExperience(env);
      const before = await rows(env, 'experiences');

      for (const [field, body] of [
        ['role', { role: '' }],
        ['startDate', { startDate: '2021-00' }],
        ['endDate', { startDate: '2023-06', endDate: '2021-03' }],
      ] as const) {
        const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, body);

        expect(response.status, field).toBe(400);
        expect(problemDetailsSchema.parse(await response.json()).errors?.map((error) => error.path), field).toContain(field);
      }
      expect(await rows(env, 'experiences')).toEqual(before);
    });
  });

  it('RES-11 answers 400 on endDate when the end sent is before the start already saved, and when the start sent is after the end saved', async () => {
    await withResumeEnv('res_item_update_saved_dates', async (env) => {
      const created = await createExperience(env);
      const before = await rows(env, 'experiences');

      const end = await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, { endDate: '2021-02' });
      const start = await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, { startDate: '2024-01' });

      for (const response of [end, start]) {
        expect(response.status).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).errors?.map((error) => error.path)).toEqual(['endDate']);
      }
      expect(await rows(env, 'experiences')).toEqual(before);
      // The same month is allowed, and so is an end that goes away.
      expect((await call(env, env.ana, 'PATCH', `/resume/experiences/${created.id}`, { endDate: '2021-03' })).status).toBe(200);
    });
  });

  it('RES-14 answers 404 for an id of another account, one that does not exist, one of another section or one that is not a uuid, and changes nothing', async () => {
    await withResumeEnv('res_item_update_404', async (env) => {
      const own = await createExperience(env);
      const brunos = await seedExperience(env.databaseUrl, { userId: env.bruno.id, company: 'Empresa Fictícia Gama' });
      const project = projectSchema.parse(await (await call(env, env.ana, 'POST', '/resume/projects', { name: 'Projeto Fictício Alfa' })).json());
      const before = { experiences: await rows(env, 'experiences'), projects: await rows(env, 'projects') };

      const attempts: Array<[string, string]> = [
        ['experiences', brunos],
        ['experiences', '0195f3a0-0000-7000-8000-00000000dead'],
        ['experiences', project.id],
        ['projects', own.id],
        ['experiences', 'not-a-uuid'],
        ['experiences', '123'],
      ];
      for (const [section, id] of attempts) {
        const response = await call(env, env.ana, 'PATCH', `/resume/${section}/${id}`, { company: 'Empresa Alterada' });

        expect(response.status, `${section} ${id}`).toBe(404);
        expect(problemDetailsSchema.parse(await response.json()).status).toBe(404);
      }
      expect(await call(env, env.ana, 'PATCH', `/resume/skills/${own.id}`, { company: 'x' })).toHaveProperty('status', 404);
      expect({ experiences: await rows(env, 'experiences'), projects: await rows(env, 'projects') }).toEqual(before);
    });
  });
});
