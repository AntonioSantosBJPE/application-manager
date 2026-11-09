import { applicationDetailSchema, invalidSkillsProblemSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

const privateSkill = async (env: ApplicationsEnv, account: ApplicationsEnv['ana'], name: string) =>
  skillSchema.parse(await (await call(env, account, 'POST', '/skills', { name, category: 'tool' })).json());

const createApplication = async (env: ApplicationsEnv, body = applicationBody()) =>
  applicationDetailSchema.parse(await (await call(env, env.ana, 'POST', '/applications', body)).json());

const storedSkills = (env: ApplicationsEnv, applicationId: string) =>
  query<{ skill_id: string; requirement: string; position: number }>(
    env.databaseUrl,
    `select s.skill_id, s.requirement, s.position
       from applications.job_posting_skills s join applications.applications a on a.job_posting_id = s.job_posting_id
      where a.id = $1 order by s.position`,
    [applicationId],
  );

const lastActivity = async (env: ApplicationsEnv, applicationId: string) =>
  (await query<{ last_activity_at: Date }>(env.databaseUrl, 'select last_activity_at from applications.applications where id = $1', [applicationId]))[0]!
    .last_activity_at;

describe('PUT /applications/:id/skills', () => {
  it('APP-30 replaces every skill with the list sent, in the order sent, answers 200 and keeps last_activity_at', async () => {
    await withApplicationsEnv('app_skills', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const python = await globalSkillId(env, 'python');
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');
      const created = await createApplication(
        env,
        applicationBody({}, { skills: [{ skillId: node, requirement: 'required' }, { skillId: react, requirement: 'required' }] }),
      );
      env.clock.advance(5 * 24 * 60 * 60 * 1000);

      const response = await call(env, env.ana, 'PUT', `/applications/${created.id}/skills`, [
        { skillId: own.id, requirement: 'nice_to_have' },
        { skillId: react, requirement: 'nice_to_have' },
        { skillId: python, requirement: 'required' },
      ]);

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body.skills.map((skill) => [skill.id, skill.requirement])).toEqual([
        [own.id, 'nice_to_have'],
        [react, 'nice_to_have'],
        [python, 'required'],
      ]);
      expect(body.lastActivityAt).toBe(created.lastActivityAt);
      expect(await storedSkills(env, created.id)).toEqual([
        { skill_id: own.id, requirement: 'nice_to_have', position: 0 },
        { skill_id: react, requirement: 'nice_to_have', position: 1 },
        { skill_id: python, requirement: 'required', position: 2 },
      ]);
      expect((await lastActivity(env, created.id)).toISOString()).toBe(created.lastActivityAt);
      // The old skill is gone from the posting, and a read shows the same list.
      const read = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());
      expect(read.skills.map((skill) => skill.id)).toEqual([own.id, react, python]);
    });
  });

  it('APP-30 an empty list removes every skill of the posting', async () => {
    await withApplicationsEnv('app_skills_empty', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const created = await createApplication(env, applicationBody({}, { skills: [{ skillId: node, requirement: 'required' }] }));

      const response = await call(env, env.ana, 'PUT', `/applications/${created.id}/skills`, []);

      expect(response.status).toBe(200);
      expect(applicationDetailSchema.parse(await response.json()).skills).toEqual([]);
      expect(await storedSkills(env, created.id)).toEqual([]);
    });
  });

  it('APP-31 answers 422 with the refused ids for an unknown, foreign, repeated or non-uuid skill and changes nothing', async () => {
    await withApplicationsEnv('app_skills_422', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const brunos = await privateSkill(env, env.bruno, 'Skill Fictícia Beta');
      const unknown = '0195f3a0-0000-7000-8000-00000000dead';
      const created = await createApplication(env, applicationBody({}, { skills: [{ skillId: node, requirement: 'required' }] }));
      const before = await storedSkills(env, created.id);
      const cases: Array<{ name: string; skills: string[]; refused: string[] }> = [
        { name: 'unknown', skills: [react, unknown], refused: [unknown] },
        { name: 'private of another account', skills: [brunos.id, react], refused: [brunos.id] },
        { name: 'repeated', skills: [react, node, react], refused: [react] },
        { name: 'not a uuid', skills: ['not-a-uuid', react], refused: ['not-a-uuid'] },
      ];

      for (const { name, skills, refused } of cases) {
        const response = await call(
          env,
          env.ana,
          'PUT',
          `/applications/${created.id}/skills`,
          skills.map((skillId) => ({ skillId, requirement: 'required' })),
        );

        expect(response.status, name).toBe(422);
        expect(response.headers.get('content-type'), name).toContain('application/problem+json');
        expect(invalidSkillsProblemSchema.parse(await response.json()).invalidSkillIds, name).toEqual(refused);
        expect(await storedSkills(env, created.id), name).toEqual(before);
      }
    });
  });

  it('APP-31 answers 400 for a body that is not a list of valid skills, or has more than 50, and changes nothing', async () => {
    await withApplicationsEnv('app_skills_400', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const created = await createApplication(env, applicationBody({}, { skills: [{ skillId: node, requirement: 'required' }] }));
      const before = await storedSkills(env, created.id);
      const invalid: Array<[string, unknown]> = [
        ['an object', { skills: [] }],
        ['an unknown requirement', [{ skillId: node, requirement: 'optional' }]],
        ['no requirement', [{ skillId: node }]],
        ['51 skills', Array.from({ length: 51 }, () => ({ skillId: node, requirement: 'required' }))],
      ];

      for (const [name, body] of invalid) {
        const response = await call(env, env.ana, 'PUT', `/applications/${created.id}/skills`, body);

        expect(response.status, name).toBe(400);
        expect(await storedSkills(env, created.id), name).toEqual(before);
      }
    });
  });
});
