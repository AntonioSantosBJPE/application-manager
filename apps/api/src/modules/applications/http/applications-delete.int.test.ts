import { applicationDetailSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

/** An application with two skills, a status change, a stage and a note: a row in each of the four tables, and more. */
const createFull = async (env: ApplicationsEnv, account: ApplicationsEnv['ana']) => {
  const node = await globalSkillId(env, 'nodejs');
  const react = await globalSkillId(env, 'react');
  const created = applicationDetailSchema.parse(
    await (
      await call(env, account, 'POST', '/applications', applicationBody({}, { status: 'applied', skills: [{ skillId: node, requirement: 'required' }, { skillId: react, requirement: 'nice_to_have' }] }))
    ).json(),
  );
  await call(env, account, 'POST', `/applications/${created.id}/status`, { status: 'interviewing' });
  await call(env, account, 'POST', `/applications/${created.id}/events`, { kind: 'stage', stage: 'hr' });
  await call(env, account, 'POST', `/applications/${created.id}/events`, { kind: 'note', note: 'Nota fictícia.' });
  return created.id;
};

/** How many rows of each of the four tables belong to the application. */
const rowsOf = async (env: ApplicationsEnv, applicationId: string) => {
  const [counts] = await query<Record<string, number>>(
    env.databaseUrl,
    `select
       (select count(*)::int from applications.applications where id = $1) as applications,
       (select count(*)::int from applications.application_events where application_id = $1) as events,
       (select count(*)::int from applications.job_postings p where p.id in (select job_posting_id from applications.applications where id = $1)) as postings,
       (select count(*)::int from applications.job_posting_skills s where s.job_posting_id in (select job_posting_id from applications.applications where id = $1)) as skills`,
    [applicationId],
  );
  return counts!;
};

const totals = async (env: ApplicationsEnv) =>
  (
    await query<Record<string, number>>(
      env.databaseUrl,
      `select (select count(*)::int from applications.job_postings) as postings,
              (select count(*)::int from applications.job_posting_skills) as skills,
              (select count(*)::int from applications.applications) as applications,
              (select count(*)::int from applications.application_events) as events`,
    )
  )[0]!;

describe('DELETE /applications/:id', () => {
  it('APP-36 answers 204 with no body and leaves no row of the four tables behind', async () => {
    await withApplicationsEnv('app_delete', async (env) => {
      const id = await createFull(env, env.ana);
      expect(await rowsOf(env, id)).toEqual({ applications: 1, events: 4, postings: 1, skills: 2 });

      const response = await call(env, env.ana, 'DELETE', `/applications/${id}`);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(await rowsOf(env, id)).toEqual({ applications: 0, events: 0, postings: 0, skills: 0 });
      expect(await totals(env)).toEqual({ postings: 0, skills: 0, applications: 0, events: 0 });
      expect((await call(env, env.ana, 'GET', `/applications/${id}`)).status).toBe(404);
    });
  });

  it('APP-36 deletes only that application: the others of the same person and of another one keep every row', async () => {
    await withApplicationsEnv('app_delete_only', async (env) => {
      const target = await createFull(env, env.ana);
      const sibling = await createFull(env, env.ana);
      const others = await createFull(env, env.bruno);
      const before = [await rowsOf(env, sibling), await rowsOf(env, others)];

      expect((await call(env, env.ana, 'DELETE', `/applications/${target}`)).status).toBe(204);

      expect([await rowsOf(env, sibling), await rowsOf(env, others)]).toEqual(before);
      expect(await totals(env)).toEqual({ postings: 2, skills: 4, applications: 2, events: 8 });
    });
  });

  it('APP-37 answers 404 in Problem Details when the same application is deleted again', async () => {
    await withApplicationsEnv('app_delete_twice', async (env) => {
      const id = await createFull(env, env.ana);
      expect((await call(env, env.ana, 'DELETE', `/applications/${id}`)).status).toBe(204);

      const again = await call(env, env.ana, 'DELETE', `/applications/${id}`);

      expect(again.status).toBe(404);
      expect(again.headers.get('content-type')).toContain('application/problem+json');
      expect(problemDetailsSchema.parse(await again.json()).status).toBe(404);
    });
  });

  it('APP-37 two deletes at the same time answer one 204 and one 404', async () => {
    await withApplicationsEnv('app_delete_race', async (env) => {
      const id = await createFull(env, env.ana);

      const responses = await Promise.all([call(env, env.ana, 'DELETE', `/applications/${id}`), call(env, env.ana, 'DELETE', `/applications/${id}`)]);

      expect(responses.map((response) => response.status).sort()).toEqual([204, 404]);
      expect(await rowsOf(env, id)).toEqual({ applications: 0, events: 0, postings: 0, skills: 0 });
    });
  });
});
