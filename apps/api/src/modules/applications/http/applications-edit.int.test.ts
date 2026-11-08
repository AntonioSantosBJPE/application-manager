import { applicationDetailSchema, applicationsPageSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';
import { searchTextOf } from '../domain/search-text.js';

const createApplication = async (env: ApplicationsEnv, body = applicationBody()) =>
  applicationDetailSchema.parse(await (await call(env, env.ana, 'POST', '/applications', body)).json());

const postingRow = async (env: ApplicationsEnv, id: string) =>
  (
    await query<Record<string, unknown>>(
      env.databaseUrl,
      `select p.company, p.title, p.url, p.description, p.level, p.location, p.work_model, p.search_text, a.last_activity_at
         from applications.applications a join applications.job_postings p on p.id = a.job_posting_id where a.id = $1`,
      [id],
    )
  )[0]!;

const FULL = {
  url: 'https://vagas.exemplo.com/1',
  description: 'Texto fictício da vaga.',
  location: 'Recife',
  workModel: 'hybrid',
  level: 'junior',
};

describe('PATCH /applications/:id/job-posting', () => {
  it('APP-28 changes only the fields sent, answers 200 with the application and keeps last_activity_at', async () => {
    await withApplicationsEnv('app_edit', async (env) => {
      const created = await createApplication(env, applicationBody(FULL));
      env.clock.advance(3 * 24 * 60 * 60 * 1000);

      const response = await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, {
        title: '  Vaga de Teste Sênior ',
        level: 'senior',
      });

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body).toMatchObject({
        id: created.id,
        status: 'saved',
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Sênior',
        level: 'senior',
        url: FULL.url,
        description: FULL.description,
        location: 'Recife',
        workModel: 'hybrid',
        lastActivityAt: created.lastActivityAt,
        createdAt: created.createdAt,
      });
      expect(await postingRow(env, created.id)).toMatchObject({
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Sênior',
        last_activity_at: new Date(created.lastActivityAt),
      });
    });
  });

  it('APP-28 recomputes the search text so the list finds the new name and no longer the old one', async () => {
    await withApplicationsEnv('app_edit_search', async (env) => {
      const created = await createApplication(env);

      await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, { company: 'Empresa Fictícia Beta' });

      expect((await postingRow(env, created.id)).search_text).toBe(searchTextOf('Empresa Fictícia Beta', 'Vaga de Teste Pleno'));
      const found = async (q: string) =>
        applicationsPageSchema.parse(await (await call(env, env.ana, 'GET', `/applications?q=${encodeURIComponent(q)}`)).json()).items.map((item) => item.id);
      expect(await found('beta')).toEqual([created.id]);
      expect(await found('alfa')).toEqual([]);

      await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, { title: 'Analista Fictício' });

      expect((await postingRow(env, created.id)).search_text).toBe(searchTextOf('Empresa Fictícia Beta', 'Analista Fictício'));
      expect(await found('analista')).toEqual([created.id]);
    });
  });

  it('APP-29 clears url, location, description and workModel with null and keeps the required fields', async () => {
    await withApplicationsEnv('app_edit_null', async (env) => {
      const created = await createApplication(env, applicationBody(FULL));

      const response = await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, {
        url: null,
        location: null,
        description: null,
        workModel: null,
      });

      expect(response.status).toBe(200);
      expect(applicationDetailSchema.parse(await response.json())).toMatchObject({
        url: null,
        location: null,
        description: null,
        workModel: null,
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Pleno',
        level: 'junior',
      });
      expect(await postingRow(env, created.id)).toMatchObject({ url: null, location: null, description: null, work_model: null });
    });
  });

  it('APP-29 clears one field at a time and leaves the others as they were', async () => {
    await withApplicationsEnv('app_edit_null_one', async (env) => {
      const created = await createApplication(env, applicationBody(FULL));

      await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, { location: null });

      expect(await postingRow(env, created.id)).toMatchObject({
        url: FULL.url,
        description: FULL.description,
        location: null,
        work_model: 'hybrid',
      });
    });
  });

  it('APP-31 answers 400 for an empty body or an invalid field and changes nothing', async () => {
    await withApplicationsEnv('app_edit_invalid', async (env) => {
      const created = await createApplication(env, applicationBody(FULL));
      const before = await postingRow(env, created.id);
      const invalid: unknown[] = [
        {},
        { company: '' },
        { company: '   ' },
        { title: 'x'.repeat(201) },
        { company: null },
        { title: null },
        { level: null },
        { level: 'chief' },
        { workModel: 'abroad' },
        { url: 'ftp://vagas.exemplo.com' },
        { url: 'x'.repeat(2049) },
        { location: 'x'.repeat(121) },
        { description: 'x'.repeat(20_001) },
        { title: 'Novo título', level: 'chief' },
      ];

      for (const body of invalid) {
        const response = await call(env, env.ana, 'PATCH', `/applications/${created.id}/job-posting`, body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status).toBe(400);
      }
      expect(await postingRow(env, created.id)).toEqual(before);
    });
  });
});
