import { bulletResponseSchema, invalidSkillsProblemSchema, problemDetailsSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, seedBullet, seedExperience, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const globalSkillId = async (env: ResumeEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

const bulletRows = (env: ResumeEnv) => query(env.databaseUrl, 'select to_jsonb(t) as row from resume.bullets t order by id');

/** An experience of Ana with one bullet that cites `skillIds`. */
const withBullet = async (env: ResumeEnv, skillIds: string[] = []) => {
  const experience = await seedExperience(env.databaseUrl, { userId: env.ana.id });
  const bullet = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Texto fictício original.', skillIds, position: 3 });
  return { experience, bullet };
};

describe('PATCH /resume/:section/:id/bullets/:bulletId', () => {
  it('RES-16 writes only the text and keeps the skills, answering { bullet, skills }', async () => {
    await withResumeEnv('res_bullet_update_text', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const { experience, bullet } = await withBullet(env, [node]);

      const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, { text: '  Texto fictício novo.  ' });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Object.keys(body as object).sort()).toEqual(['bullet', 'skills']);
      const parsed = bulletResponseSchema.parse(body);
      expect(parsed.bullet).toEqual({ id: bullet, text: 'Texto fictício novo.', skillIds: [node] });
      expect(parsed.skills).toEqual({ [node]: { name: 'Node.js', scope: 'global' } });
      expect(await query(env.databaseUrl, 'select text, skill_ids, position from resume.bullets')).toEqual([{ text: 'Texto fictício novo.', skill_ids: [node], position: 3 }]);
    });
  });

  it('RES-16 writes only the skills, in the order sent, and keeps the text; an empty list clears them', async () => {
    await withResumeEnv('res_bullet_update_skills', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const react = await globalSkillId(env, 'react');
      const { experience, bullet } = await withBullet(env, [node]);

      const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, { skillIds: [react, node] });

      const parsed = bulletResponseSchema.parse(await response.json());
      expect(parsed.bullet).toEqual({ id: bullet, text: 'Texto fictício original.', skillIds: [react, node] });
      expect(Object.keys(parsed.skills).sort()).toEqual([node, react].sort());
      const cleared = bulletResponseSchema.parse(await (await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, { skillIds: [] })).json());
      expect(cleared).toEqual({ bullet: { id: bullet, text: 'Texto fictício original.', skillIds: [] }, skills: {} });
    });
  });

  it('RES-16 writes the text and the skills together, and a bullet of a project works the same', async () => {
    await withResumeEnv('res_bullet_update_both', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const project = (await query<{ id: string }>(env.databaseUrl, "insert into resume.projects (user_id, name, position) values ($1, 'Projeto Fictício', 0) returning id", [env.ana.id]))[0]!.id;
      const bullet = (
        await query<{ id: string }>(env.databaseUrl, "insert into resume.bullets (user_id, project_id, text, position) values ($1, $2, 'Original.', 0) returning id", [env.ana.id, project])
      )[0]!.id;

      const response = await call(env, env.ana, 'PATCH', `/resume/projects/${project}/bullets/${bullet}`, { text: 'Novo.', skillIds: [node] });

      expect(bulletResponseSchema.parse(await response.json()).bullet).toEqual({ id: bullet, text: 'Novo.', skillIds: [node] });
    });
  });

  it('RES-16 answers 400 and writes nothing for an empty body, an empty text, a long text and more than 20 skills', async () => {
    await withResumeEnv('res_bullet_update_refuse', async (env) => {
      const { experience, bullet } = await withBullet(env);
      const before = await bulletRows(env);
      const ids = Array.from({ length: 21 }, (_, index) => `0195f3a0-0000-7000-8000-${String(index).padStart(12, '0')}`);

      for (const body of [{}, { text: '  ' }, { text: 'a'.repeat(501) }, { skillIds: ids }]) {
        const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, body);

        expect(response.status, JSON.stringify(body).slice(0, 40)).toBe(400);
        expect(problemDetailsSchema.parse(await response.json()).status).toBe(400);
      }
      expect(await bulletRows(env)).toEqual(before);
    });
  });

  it('RES-20 answers 422 with the refused ids and writes nothing for a skill that is not usable', async () => {
    await withResumeEnv('res_bullet_update_422', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const brunos = skillSchema.parse(await (await call(env, env.bruno, 'POST', '/skills', { name: 'Skill Fictícia Beta', category: 'tool' })).json());
      const { experience, bullet } = await withBullet(env, [node]);
      const before = await bulletRows(env);

      const response = await call(env, env.ana, 'PATCH', `/resume/experiences/${experience}/bullets/${bullet}`, { text: 'Texto novo.', skillIds: [brunos.id, node, node] });

      expect(response.status).toBe(422);
      expect(invalidSkillsProblemSchema.parse(await response.json()).invalidSkillIds).toEqual([brunos.id, node]);
      expect(await bulletRows(env)).toEqual(before);
    });
  });
});

describe('DELETE /resume/:section/:id/bullets/:bulletId', () => {
  it('RES-17 answers 204 and the bullet is gone, with the other bullets of the item and of other items kept', async () => {
    await withResumeEnv('res_bullet_delete', async (env) => {
      const { experience, bullet } = await withBullet(env);
      const sibling = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: experience, text: 'Irmão fictício.', position: 4 });
      const other = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });
      const stranger = await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId: other, text: 'De outro item.' });

      const response = await call(env, env.ana, 'DELETE', `/resume/experiences/${experience}/bullets/${bullet}`);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect((await query<{ id: string }>(env.databaseUrl, 'select id from resume.bullets order by id')).map((row) => row.id).sort()).toEqual([sibling, stranger].sort());
      expect((await resumeRowCounts(env.databaseUrl)).experiences).toBe(2);
    });
  });
});

describe('the bullet routes with an id that is not found', () => {
  it('RES-22 answers 404 and changes nothing for an item or a bullet of another account, a bullet of another item, one that does not exist and one that is not a uuid', async () => {
    await withResumeEnv('res_bullet_404', async (env) => {
      const { experience, bullet } = await withBullet(env);
      const other = await seedExperience(env.databaseUrl, { userId: env.ana.id, company: 'Empresa Fictícia Beta', position: 1 });
      const brunosExperience = await seedExperience(env.databaseUrl, { userId: env.bruno.id, company: 'Empresa Fictícia Gama' });
      const brunosBullet = await seedBullet(env.databaseUrl, { userId: env.bruno.id, experienceId: brunosExperience });
      const before = await bulletRows(env);
      const dead = '0195f3a0-0000-7000-8000-00000000dead';

      const targets = [
        ['bullet of another account, own item', experience, brunosBullet],
        ['item and bullet of another account', brunosExperience, brunosBullet],
        ['own bullet under the item of another account', brunosExperience, bullet],
        ['bullet of another item', other, bullet],
        ['bullet that does not exist', experience, dead],
        ['item that does not exist', dead, bullet],
        ['bullet that is not a uuid', experience, 'not-a-uuid'],
        ['item that is not a uuid', 'not-a-uuid', bullet],
      ] as const;
      for (const [name, item, id] of targets) {
        const path = `/resume/experiences/${item}/bullets/${id}`;
        const patch = await call(env, env.ana, 'PATCH', path, { text: 'Texto alterado.' });
        const patchSkills = await call(env, env.ana, 'PATCH', path, { skillIds: ['not-a-uuid'] });
        const remove = await call(env, env.ana, 'DELETE', path);

        expect([patch.status, patchSkills.status, remove.status], name).toEqual([404, 404, 404]);
        expect(problemDetailsSchema.parse(await patch.json()).status, name).toBe(404);
      }
      // The bullet is an experience's: it is not found under the projects, nor under a section with no bullets or none at all.
      for (const section of ['projects', 'educations', 'certifications', 'languages', 'skills']) {
        const path = `/resume/${section}/${experience}/bullets/${bullet}`;

        expect((await call(env, env.ana, 'PATCH', path, { text: 'Texto alterado.' })).status, section).toBe(404);
        expect((await call(env, env.ana, 'DELETE', path)).status, section).toBe(404);
      }
      expect(await bulletRows(env)).toEqual(before);
    });
  });
});
