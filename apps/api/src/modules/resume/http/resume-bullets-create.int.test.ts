import { bulletResponseSchema, invalidSkillsProblemSchema, masterResumeSchema, problemDetailsSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, seedBullet, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const globalSkillId = async (env: ResumeEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

const privateSkill = async (env: ResumeEnv, account: ResumeEnv['ana'], name: string) =>
  skillSchema.parse(await (await call(env, account, 'POST', '/skills', { name, category: 'tool' })).json());

const seedProject = async (env: ResumeEnv, userId: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, "insert into resume.projects (user_id, name, position) values ($1, 'Projeto Fictício Alfa', 0) returning id", [userId]))[0]!.id;

const read = async (env: ResumeEnv) => masterResumeSchema.parse(await (await call(env, env.ana, 'GET', '/resume')).json());

const bulletRows = (env: ResumeEnv) => query(env.databaseUrl, 'select to_jsonb(t) as row from resume.bullets t order by id');

describe('POST /resume/:section/:id/bullets', () => {
  it('RES-15 answers 201 with { bullet, skills } and nothing else, and puts the bullet at the end of the item', async () => {
    await withResumeEnv('res_bullet_create', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      const first = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Bullet fictício um.', position: 5 });
      const second = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Bullet fictício dois.', position: 2 });

      const response = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: '  Reduzi o tempo de resposta.  ', skillIds: [node] });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(Object.keys(body as object).sort()).toEqual(['bullet', 'skills']);
      const parsed = bulletResponseSchema.parse(body);
      expect(parsed.bullet).toEqual({ id: expect.any(String), text: 'Reduzi o tempo de resposta.', skillIds: [node] });
      expect(parsed.skills).toEqual({ [node]: { name: 'Node.js', scope: 'global' } });
      expect((await read(env)).experiences[0]!.bullets.map((bullet) => bullet.id)).toEqual([second, first, parsed.bullet.id]);
      expect(await query(env.databaseUrl, 'select position, user_id from resume.bullets where id = $1', [parsed.bullet.id])).toEqual([{ position: 6, user_id: env.ana.id }]);
    });
  });

  it('RES-15 starts an item at position 0 and adds a bullet to a project', async () => {
    await withResumeEnv('res_bullet_create_project', async (env) => {
      const project = await seedProject(env, env.ana.id);

      const first = await call(env, env.ana, 'POST', `/resume/projects/${project}/bullets`, { text: 'Primeiro bullet fictício.', skillIds: [] });
      const second = await call(env, env.ana, 'POST', `/resume/projects/${project}/bullets`, { text: 'Segundo bullet fictício.', skillIds: [] });

      expect([first.status, second.status]).toEqual([201, 201]);
      expect((await read(env)).projects[0]!.bullets.map((bullet) => bullet.text)).toEqual(['Primeiro bullet fictício.', 'Segundo bullet fictício.']);
      expect(await query(env.databaseUrl, 'select position from resume.bullets order by position')).toEqual([{ position: 0 }, { position: 1 }]);
    });
  });

  it('RES-18 accepts an empty skillIds and answers it with an empty list and no skills', async () => {
    await withResumeEnv('res_bullet_create_noskill', async (env) => {
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });

      const response = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício sem skill.', skillIds: [] });

      expect(response.status).toBe(201);
      const parsed = bulletResponseSchema.parse(await response.json());
      expect(parsed.bullet.skillIds).toEqual([]);
      expect(parsed.skills).toEqual({});
    });
  });

  it('RES-19 answers 400 with the invalid field and writes nothing for an empty text, a text over 500 characters and more than 20 skills', async () => {
    await withResumeEnv('res_bullet_create_refuse', async (env) => {
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      const ids = Array.from({ length: 21 }, (_, index) => `0195f3a0-0000-7000-8000-${String(index).padStart(12, '0')}`);
      const refusals: Array<[string, unknown]> = [
        ['text', { text: '   ', skillIds: [] }],
        ['text', { text: 'a'.repeat(501), skillIds: [] }],
        ['skillIds', { text: 'Bullet fictício.', skillIds: ids }],
        ['skillIds', { text: 'Bullet fictício.' }],
        ['text', { skillIds: [] }],
      ];

      for (const [field, body] of refusals) {
        const response = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, body);

        expect(response.status, field).toBe(400);
        expect(problemDetailsSchema.parse(await response.json()).errors?.map((error) => error.path), field).toContain(field);
      }
      expect((await resumeRowCounts(env.databaseUrl)).bullets).toBe(0);
      // The limits themselves are accepted: 500 characters, and 20 skills that exist (21 was refused above).
      const edgeText = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'a'.repeat(500), skillIds: [] });
      expect(edgeText.status).toBe(201);
      const twenty = await Promise.all(Array.from({ length: 21 }, (_, index) => privateSkill(env, env.ana, `Skill Fictícia ${index + 1}`)));
      const edgeSkills = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício.', skillIds: twenty.slice(0, 20).map((skill) => skill.id) });
      expect(edgeSkills.status).toBe(201);
      expect(bulletResponseSchema.parse(await edgeSkills.json()).bullet.skillIds).toHaveLength(20);
      const over = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício.', skillIds: twenty.map((skill) => skill.id) });
      expect(over.status).toBe(400);
    });
  });

  it('RES-20 answers 422 with the refused ids and writes nothing for an unknown skill, a private skill of another account, a repeated skill and an id that is not a uuid', async () => {
    await withResumeEnv('res_bullet_create_422', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const brunos = await privateSkill(env, env.bruno, 'Skill Fictícia Beta');
      const unknown = '0195f3a0-0000-7000-8000-00000000dead';
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      const cases: Array<[string, string[], string[]]> = [
        ['unknown', [node, unknown], [unknown]],
        ['private of another account', [brunos.id, node], [brunos.id]],
        ['repeated', [node, node], [node]],
        ['not a uuid', ['not-a-uuid', node], ['not-a-uuid']],
      ];

      for (const [name, skillIds, refused] of cases) {
        const response = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício.', skillIds });

        expect(response.status, name).toBe(422);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        expect(invalidSkillsProblemSchema.parse(await response.json()).invalidSkillIds, name).toEqual(refused);
      }
      expect((await resumeRowCounts(env.databaseUrl)).bullets).toBe(0);
    });
  });

  it('RES-20 accepts the own private skill and a global skill written in capitals', async () => {
    await withResumeEnv('res_bullet_create_own', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });

      const response = await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício.', skillIds: [own.id, node.toUpperCase()] });

      expect(response.status).toBe(201);
      const parsed = bulletResponseSchema.parse(await response.json());
      expect(parsed.bullet.skillIds).toEqual([own.id, node]);
      expect(parsed.skills[own.id]).toEqual({ name: 'Skill Fictícia Alfa', scope: 'private' });
    });
  });

  it('RES-21 answers 422 in Problem Details on the 31st bullet of an item and writes nothing, while another item still takes one', async () => {
    await withResumeEnv('res_bullet_create_limit', async (env) => {
      const full = await seedExperience(env.databaseUrl, { userId: env.ana.id, position: 0 });
      const other = await seedExperience(env.databaseUrl, { userId: env.ana.id, position: 1 });
      await query(
        env.databaseUrl,
        `insert into resume.bullets (user_id, experience_id, text, position)
         select $1, $2, 'Bullet fictício ' || n, n from generate_series(1, 30) as n`,
        [env.ana.id, full],
      );

      const response = await call(env, env.ana, 'POST', `/resume/experiences/${full}/bullets`, { text: 'Bullet fictício extra.', skillIds: [] });

      expect(response.status).toBe(422);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(problemDetailsSchema.parse(await response.json()).status).toBe(422);
      expect((await resumeRowCounts(env.databaseUrl)).bullets).toBe(30);
      expect((await call(env, env.ana, 'POST', `/resume/experiences/${other}/bullets`, { text: 'Bullet fictício.', skillIds: [] })).status).toBe(201);
    });
  });

  it('RES-22 answers 404 and writes nothing for an item of another account, one that does not exist, one that is not a uuid, and a section with no bullets or none at all', async () => {
    await withResumeEnv('res_bullet_create_404', async (env) => {
      const brunos = await seedExperience(env.databaseUrl, { userId: env.bruno.id });
      const own = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      const body = { text: 'Bullet fictício.', skillIds: [] };
      const before = await bulletRows(env);

      const paths = [
        `/resume/experiences/${brunos}/bullets`,
        `/resume/experiences/0195f3a0-0000-7000-8000-00000000dead/bullets`,
        `/resume/projects/${own}/bullets`,
        `/resume/experiences/not-a-uuid/bullets`,
        `/resume/educations/${own}/bullets`,
        `/resume/certifications/${own}/bullets`,
        `/resume/languages/${own}/bullets`,
        `/resume/skills/${own}/bullets`,
      ];
      for (const path of paths) {
        const response = await call(env, env.ana, 'POST', path, body);

        expect(response.status, path).toBe(404);
        expect(problemDetailsSchema.parse(await response.json()).status, path).toBe(404);
      }
      expect(await bulletRows(env)).toEqual(before);
    });
  });

  it('RES-23 keeps skillIds in the order they were marked and describes each skill once, also when three bullets cite the same one', async () => {
    await withResumeEnv('res_bullet_create_dictionary', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });

      const first = bulletResponseSchema.parse(await (await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Primeiro.', skillIds: [react, own.id, node] })).json());
      const second = bulletResponseSchema.parse(await (await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Segundo.', skillIds: [node] })).json());
      await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Terceiro.', skillIds: [node, react] });

      expect(first.bullet.skillIds).toEqual([react, own.id, node]);
      expect(Object.keys(first.skills).sort()).toEqual([node, own.id, react].sort());
      expect(Object.keys(second.skills)).toEqual([node]);
      const resume = await read(env);
      expect(resume.experiences[0]!.bullets.map((bullet) => bullet.skillIds)).toEqual([[react, own.id, node], [node], [node, react]]);
      expect(Object.keys(resume.skills).sort()).toEqual([node, own.id, react].sort());
      expect(resume.skills[node]).toEqual({ name: 'Node.js', scope: 'global' });
    });
  });

  it('RES-24 brings a private skill promoted by the admin back with the same id and scope global', async () => {
    await withResumeEnv('res_bullet_create_promoted', async (env) => {
      const own = await privateSkill(env, env.ana, 'Skill Fictícia Alfa');
      const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      await call(env, env.ana, 'POST', `/resume/experiences/${experience}/bullets`, { text: 'Bullet fictício.', skillIds: [own.id] });
      expect((await read(env)).skills[own.id]).toEqual({ name: 'Skill Fictícia Alfa', scope: 'private' });

      expect((await call(env, env.admin, 'POST', `/skills/${own.id}/promote`)).status).toBe(200);

      const resume = await read(env);
      expect(resume.skills[own.id]).toEqual({ name: 'Skill Fictícia Alfa', scope: 'global' });
      expect(resume.experiences[0]!.bullets[0]!.skillIds).toEqual([own.id]);
    });
  });

  it('RES-02 answers the bullets of each item in the order of position, inside each experience and each project', async () => {
    await withResumeEnv('res_bullet_read_order', async (env) => {
      const alfa = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Alfa', position: 0 });
      const beta = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });
      const project = await seedProject(env, env.ana.id);
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: alfa, text: 'Alfa terceiro.', position: 9 });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: alfa, text: 'Alfa primeiro.', position: -3 });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: beta, text: 'Beta único.', position: 4 });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: alfa, text: 'Alfa segundo.', position: 1 });
      await query(env.databaseUrl, "insert into resume.bullets (user_id, project_id, text, position) values ($1, $2, 'Projeto segundo.', 2), ($1, $2, 'Projeto primeiro.', 1)", [env.ana.id, project]);

      const resume = await read(env);

      expect(resume.experiences.map((item) => item.bullets.map((bullet) => bullet.text))).toEqual([['Alfa primeiro.', 'Alfa segundo.', 'Alfa terceiro.'], ['Beta único.']]);
      expect(resume.projects[0]!.bullets.map((bullet) => bullet.text)).toEqual(['Projeto primeiro.', 'Projeto segundo.']);
    });
  });
});
