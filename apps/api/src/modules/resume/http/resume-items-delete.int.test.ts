import { masterResumeSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, seedBullet, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const rows = (env: ResumeEnv, table: string) => query(env.databaseUrl, `select to_jsonb(t) as row from resume.${table} t order by id`);

const seedProject = async (env: ResumeEnv, userId: string, name: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'insert into resume.projects (user_id, name, position) values ($1, $2, 0) returning id', [userId, name]))[0]!.id;

describe('DELETE /resume/:section/:id', () => {
  it('RES-09 answers 204, deletes the experience and its bullets and keeps the bullets of another experience', async () => {
    await withResumeEnv('res_item_delete_bullets', async (env) => {
      const doomed = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Alfa', position: 0 });
      const kept = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: doomed, text: 'Bullet fictício um.' });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: doomed, text: 'Bullet fictício dois.', position: 1 });
      const keptBullet = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: kept, text: 'Bullet fictício três.' });

      const response = await call(env, env.ana, 'DELETE', `/resume/experiences/${doomed}`);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      const read = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());
      expect(read.experiences.map((item) => item.id)).toEqual([kept]);
      expect(read.experiences[0]!.bullets.map((bullet) => bullet.id)).toEqual([keptBullet]);
      expect((await resumeRowCounts(env.databaseUrl)).bullets).toBe(1);
    });
  });

  it('RES-09 deletes a project with its bullets', async () => {
    await withResumeEnv('res_item_delete_project', async (env) => {
      const project = await seedProject(env, env.ana.id, 'Projeto Fictício Alfa');
      await query(env.databaseUrl, "insert into resume.bullets (user_id, project_id, text, position) values ($1, $2, 'Bullet fictício.', 0)", [env.ana.id, project]);

      const response = await call(env, env.ana, 'DELETE', `/resume/projects/${project}`);

      expect(response.status).toBe(204);
      const counts = await resumeRowCounts(env.databaseUrl);
      expect([counts.projects, counts.bullets]).toEqual([0, 0]);
    });
  });

  it('RES-10 answers 204 and deletes an education, a certification and a language, and only that one', async () => {
    await withResumeEnv('res_item_delete_plain', async (env) => {
      const created: Array<[string, string]> = [];
      for (const [section, body] of [
        ['educations', { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2015-02' }],
        ['certifications', { name: 'Certificação Fictícia' }],
        ['languages', { language: 'Inglês', level: 'basic' }],
      ] as const) {
        const keep = await call(env, env.ana, 'POST', `/resume/${section}`, body);
        expect(keep.status).toBe(201);
        const doomed = (await (await call(env, env.ana, 'POST', `/resume/${section}`, body)).json()) as { id: string };
        created.push([section, doomed.id]);
      }

      for (const [section, id] of created) {
        const response = await call(env, env.ana, 'DELETE', `/resume/${section}/${id}`);

        expect(response.status, section).toBe(204);
      }
      const read = masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());
      expect([read.educations.length, read.certifications.length, read.languages.length]).toEqual([1, 1, 1]);
      const remaining = [...read.educations, ...read.certifications, ...read.languages].map((item) => item.id);
      for (const [section, id] of created) expect(remaining, section).not.toContain(id);
    });
  });

  it('RES-14 answers 404 for an id of another account, one that does not exist, one of another section, one that is not a uuid and a section that does not exist, and deletes nothing', async () => {
    await withResumeEnv('res_item_delete_404', async (env) => {
      const own = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: own });
      const brunos = await seedExperience(env.databaseUrl, { userId: env.bruno.id, company: 'Empresa Fictícia Gama' });
      await seedBullet(env.databaseUrl, { userId: env.bruno.id, experienceId: brunos });
      const before = { experiences: await rows(env, 'experiences'), bullets: await rows(env, 'bullets') };

      const attempts: Array<[string, string]> = [
        ['experiences', brunos],
        ['experiences', '0195f3a0-0000-7000-8000-00000000dead'],
        ['projects', own],
        ['educations', own],
        ['experiences', 'not-a-uuid'],
        ['experiences', '123'],
        ['skills', own],
      ];
      for (const [section, id] of attempts) {
        const response = await call(env, env.ana, 'DELETE', `/resume/${section}/${id}`);

        expect(response.status, `${section} ${id}`).toBe(404);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status).toBe(404);
      }
      expect({ experiences: await rows(env, 'experiences'), bullets: await rows(env, 'bullets') }).toEqual(before);
    });
  });
});
