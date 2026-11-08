import { applicationDetailSchema, invalidSkillsProblemSchema, problemDetailsSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

const privateSkill = async (env: ApplicationsEnv, account: ApplicationsEnv['ana'], name: string) =>
  skillSchema.parse(await (await call(env, account, 'POST', '/skills', { name, category: 'tool' })).json());

const countRows = async (env: ApplicationsEnv): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const table of ['job_postings', 'job_posting_skills', 'applications', 'application_events']) {
    counts[table] = Number((await query<{ count: string }>(env.databaseUrl, `select count(*) from applications.${table}`))[0]!.count);
  }
  return counts;
};

const nothingWritten = { job_postings: 0, job_posting_skills: 0, applications: 0, application_events: 0 };

describe('POST /applications', () => {
  it('APP-01 writes the posting, its skills in the order sent and the application, and answers 201 saved with lastActivityAt equal to createdAt', async () => {
    await withApplicationsEnv('app_create', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');

      const response = await call(
        env,
        env.ana,
        'POST',
        '/applications',
        applicationBody(
          {
            company: '  Empresa Fictícia Alfa ',
            title: 'Vaga de Teste Pleno',
            url: 'https://vagas.exemplo.com/1',
            description: 'Texto fictício da vaga.',
            level: 'senior',
            location: 'Recife',
            workModel: 'remote',
          },
          {
            skills: [
              { skillId: react, requirement: 'nice_to_have' },
              { skillId: node, requirement: 'required' },
              { skillId: own.id, requirement: 'required' },
            ],
          },
        ),
      );

      expect(response.status).toBe(201);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body).toMatchObject({
        status: 'saved',
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Pleno',
        url: 'https://vagas.exemplo.com/1',
        description: 'Texto fictício da vaga.',
        level: 'senior',
        location: 'Recife',
        workModel: 'remote',
        ghostSuggested: false,
        events: [],
        createdAt: env.clock.now().toISOString(),
        lastActivityAt: env.clock.now().toISOString(),
      });
      expect(body.skills).toEqual([
        { id: react, name: 'React', scope: 'global', category: 'framework', requirement: 'nice_to_have' },
        { id: node, name: 'Node.js', scope: 'global', category: 'language', requirement: 'required' },
        { id: own.id, name: 'Skill Fictícia Alfa', scope: 'private', category: 'tool', requirement: 'required' },
      ]);
      expect(await countRows(env)).toEqual({ job_postings: 1, job_posting_skills: 3, applications: 1, application_events: 0 });
      const rows = await query<{ skill_id: string; position: number }>(
        env.databaseUrl,
        'select skill_id, position from applications.job_posting_skills order by position',
      );
      expect(rows).toEqual([
        { skill_id: react, position: 0 },
        { skill_id: node, position: 1 },
        { skill_id: own.id, position: 2 },
      ]);
      const [posting] = await query<{ user_id: string; search_text: string; created_at: Date }>(
        env.databaseUrl,
        'select user_id, search_text, created_at from applications.job_postings',
      );
      expect(posting).toMatchObject({ user_id: env.ana.id, search_text: 'empresa ficticia alfa\nvaga de teste pleno' });
      expect(posting!.created_at.toISOString()).toBe(env.clock.now().toISOString());
      const [application] = await query<{ id: string; user_id: string; last_activity_at: Date }>(
        env.databaseUrl,
        'select id, user_id, last_activity_at from applications.applications',
      );
      expect(application).toMatchObject({ id: body.id, user_id: env.ana.id });
      expect(application!.last_activity_at.toISOString()).toBe(env.clock.now().toISOString());
    });
  });

  it('APP-01 commits everything or nothing: a failure on the last write leaves no posting and no skill behind', async () => {
    await withApplicationsEnv('app_create_tx', async (env) => {
      await query(
        env.databaseUrl,
        `create function applications.refuse_application() returns trigger language plpgsql as $$ begin raise exception 'refused'; end $$`,
      );
      await query(
        env.databaseUrl,
        'create trigger refuse before insert on applications.applications for each row execute function applications.refuse_application()',
      );
      const node = await globalSkillId(env, 'nodejs');

      const response = await call(env, env.ana, 'POST', '/applications', applicationBody({}, { skills: [{ skillId: node, requirement: 'required' }] }));

      expect(response.status).toBe(500);
      expect(await countRows(env)).toEqual(nothingWritten);
    });
  });

  it('APP-02 creates in the status sent and writes one status_changed event with no from_status', async () => {
    await withApplicationsEnv('app_create_status', async (env) => {
      const response = await call(env, env.ana, 'POST', '/applications', applicationBody({}, { status: 'applied' }));

      expect(response.status).toBe(201);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body.status).toBe('applied');
      expect(body.events).toEqual([
        {
          id: expect.any(String),
          kind: 'status_changed',
          fromStatus: null,
          toStatus: 'applied',
          stage: null,
          note: null,
          occurredAt: env.clock.now().toISOString(),
        },
      ]);
      const events = await query<{ kind: string; from_status: string | null; to_status: string; occurred_at: Date }>(
        env.databaseUrl,
        'select kind, from_status, to_status, occurred_at from applications.application_events',
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: 'status_changed', from_status: null, to_status: 'applied' });
      expect(events[0]!.occurred_at.toISOString()).toBe(env.clock.now().toISOString());
    });
  });

  it('APP-02 writes no event for saved, sent or not, and one event for each other status', async () => {
    await withApplicationsEnv('app_create_statuses', async (env) => {
      await call(env, env.ana, 'POST', '/applications', applicationBody());
      await call(env, env.ana, 'POST', '/applications', applicationBody({}, { status: 'saved' }));
      expect((await countRows(env)).application_events).toBe(0);

      for (const status of ['interviewing', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted']) {
        const response = await call(env, env.ana, 'POST', '/applications', applicationBody({}, { status }));
        expect(response.status).toBe(201);
        expect(applicationDetailSchema.parse(await response.json()).status).toBe(status);
      }

      expect((await countRows(env)).application_events).toBe(6);
      expect(
        await query(env.databaseUrl, 'select 1 from applications.application_events where from_status is not null'),
      ).toEqual([]);
    });
  });

  it('APP-03 creates an application with no skills when skills is empty or missing', async () => {
    await withApplicationsEnv('app_create_noskills', async (env) => {
      const empty = await call(env, env.ana, 'POST', '/applications', applicationBody({}, { skills: [] }));
      const missing = await call(env, env.ana, 'POST', '/applications', applicationBody());

      expect(empty.status).toBe(201);
      expect(missing.status).toBe(201);
      expect(applicationDetailSchema.parse(await empty.json()).skills).toEqual([]);
      expect(applicationDetailSchema.parse(await missing.json()).skills).toEqual([]);
      expect(await countRows(env)).toEqual({ job_postings: 2, job_posting_skills: 0, applications: 2, application_events: 0 });
    });
  });

  it('APP-04 answers 400 in Problem Details naming the invalid field and writes nothing', async () => {
    await withApplicationsEnv('app_create_invalid', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const cases: Array<{ name: string; body: unknown; path: string }> = [
        { name: 'empty company', body: applicationBody({ company: '' }), path: 'jobPosting.company' },
        { name: 'blank company', body: applicationBody({ company: '   ' }), path: 'jobPosting.company' },
        { name: 'company of 201', body: applicationBody({ company: 'a'.repeat(201) }), path: 'jobPosting.company' },
        { name: 'missing company', body: applicationBody({ company: undefined }), path: 'jobPosting.company' },
        { name: 'empty title', body: applicationBody({ title: '' }), path: 'jobPosting.title' },
        { name: 'title of 201', body: applicationBody({ title: 't'.repeat(201) }), path: 'jobPosting.title' },
        { name: 'ftp link', body: applicationBody({ url: 'ftp://vagas.exemplo.com/1' }), path: 'jobPosting.url' },
        { name: 'link of 2049', body: applicationBody({ url: `https://vagas.exemplo.com/${'a'.repeat(2049 - 26)}` }), path: 'jobPosting.url' },
        { name: 'description of 20001', body: applicationBody({ description: 'd'.repeat(20_001) }), path: 'jobPosting.description' },
        { name: 'location of 121', body: applicationBody({ location: 'l'.repeat(121) }), path: 'jobPosting.location' },
        { name: 'level outside the enum', body: applicationBody({ level: 'principal' }), path: 'jobPosting.level' },
        { name: 'missing level', body: applicationBody({ level: undefined }), path: 'jobPosting.level' },
        { name: 'workModel outside the enum', body: applicationBody({ workModel: 'remoto' }), path: 'jobPosting.workModel' },
        { name: 'status outside the enum', body: applicationBody({}, { status: 'archived' }), path: 'status' },
        {
          name: 'requirement outside the enum',
          body: applicationBody({}, { skills: [{ skillId: node, requirement: 'optional' }] }),
          path: 'skills.0.requirement',
        },
        {
          name: '51 skills',
          body: applicationBody({}, { skills: Array.from({ length: 51 }, () => ({ skillId: node, requirement: 'required' })) }),
          path: 'skills',
        },
        { name: 'no jobPosting', body: { skills: [] }, path: 'jobPosting' },
      ];

      for (const { name, body, path } of cases) {
        const response = await call(env, env.ana, 'POST', '/applications', body);

        expect(response.status, name).toBe(400);
        expect(response.headers.get('content-type'), name).toContain('application/problem+json');
        const problem = problemDetailsSchema.parse(await response.json());
        expect(problem.status, name).toBe(400);
        expect(problem.errors?.map((error) => error.path), name).toContain(path);
      }
      expect(await countRows(env)).toEqual(nothingWritten);
    });
  });

  it('APP-05 answers 422 with the refused ids for a skill that does not exist, is private to someone else, repeats or is not a uuid, and writes nothing', async () => {
    await withApplicationsEnv('app_create_422', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const brunos = await privateSkill(env, env.bruno, 'Skill Fictícia Beta');
      const unknown = '0195f3a0-0000-7000-8000-00000000dead';
      const cases: Array<{ name: string; skills: string[]; refused: string[] }> = [
        { name: 'unknown', skills: [node, unknown], refused: [unknown] },
        { name: 'private of another account', skills: [brunos.id, node], refused: [brunos.id] },
        { name: 'repeated', skills: [node, react, node], refused: [node] },
        { name: 'not a uuid', skills: ['not-a-uuid', node], refused: ['not-a-uuid'] },
        { name: 'several', skills: [unknown, brunos.id, 'x', 'x', react], refused: [unknown, brunos.id, 'x'] },
      ];

      for (const { name, skills, refused } of cases) {
        const response = await call(
          env,
          env.ana,
          'POST',
          '/applications',
          applicationBody({}, { skills: skills.map((skillId) => ({ skillId, requirement: 'required' })) }),
        );

        expect(response.status, name).toBe(422);
        expect(response.headers.get('content-type'), name).toContain('application/problem+json');
        const problem = invalidSkillsProblemSchema.parse(await response.json());
        expect(problem.status, name).toBe(422);
        expect(problem.invalidSkillIds, name).toEqual(refused);
      }
      expect(await countRows(env)).toEqual(nothingWritten);
    });
  });

  it('APP-05 accepts the own private skill and the uuid written in capitals', async () => {
    await withApplicationsEnv('app_create_own', async (env) => {
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');

      const response = await call(
        env,
        env.ana,
        'POST',
        '/applications',
        applicationBody({}, { skills: [{ skillId: own.id.toUpperCase(), requirement: 'required' }] }),
      );

      expect(response.status).toBe(201);
      expect(applicationDetailSchema.parse(await response.json()).skills.map((skill) => skill.id)).toEqual([own.id]);
    });
  });

  it('APP-06 takes the owner from the session and ignores a userId sent by the client', async () => {
    await withApplicationsEnv('app_create_owner', async (env) => {
      const response = await call(env, env.ana, 'POST', '/applications', {
        userId: env.bruno.id,
        jobPosting: { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid', userId: env.bruno.id },
      });

      expect(response.status).toBe(201);
      expect(await query(env.databaseUrl, 'select user_id from applications.job_postings')).toEqual([{ user_id: env.ana.id }]);
      expect(await query(env.databaseUrl, 'select user_id from applications.applications')).toEqual([{ user_id: env.ana.id }]);
      expect(await response.json()).not.toHaveProperty('userId');
    });
  });
});
