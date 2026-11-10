import { resumeSummarySchema } from '@am/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillsCatalog } from '../../skills/index.js';
import { call, resumeRowCounts, seedBullet, seedExperience, seedProfile, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const skillId = '0195f3a0-0000-7000-8000-000000000001';

const ready = async (env: ResumeEnv): Promise<boolean> => {
  const response = await call(env, env.ana, 'GET', '/resume/summary');
  expect(response.status).toBe(200);
  return resumeSummarySchema.parse(await response.json()).ready;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /resume/summary', () => {
  it('RES-86 answers false for a new account, for a name alone and for a bullet with a skill but no name', async () => {
    await withResumeEnv('res_summary_false', async (env) => {
      expect(await ready(env)).toBe(false);

      await seedProfile(env.databaseUrl, env.ana.id, 'Pessoa Fictícia Alfa');
      expect(await ready(env)).toBe(false);

      const experienceId = await seedExperience(env.databaseUrl, { userId: env.bruno.id });
      await seedBullet(env.databaseUrl, { userId: env.bruno.id, experienceId, skillIds: [skillId] });
      const other = await call(env, env.bruno, 'GET', '/resume/summary');
      expect(resumeSummarySchema.parse(await other.json())).toEqual({ ready: false });
    });
  });

  it('RES-86 answers false for a name and a bullet without a skill, and true once the bullet has one', async () => {
    await withResumeEnv('res_summary_true', async (env) => {
      await seedProfile(env.databaseUrl, env.ana.id, 'Pessoa Fictícia Alfa');
      const experienceId = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId, skillIds: [] });
      expect(await ready(env)).toBe(false);

      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId, skillIds: [skillId], position: 1 });
      expect(await ready(env)).toBe(true);
    });
  });

  it('RES-86 does not count a profile with a blank name', async () => {
    await withResumeEnv('res_summary_blank', async (env) => {
      await seedProfile(env.databaseUrl, env.ana.id, '');
      const experienceId = await seedExperience(env.databaseUrl, { userId: env.ana.id });
      await seedBullet(env.databaseUrl, { userId: env.ana.id, experienceId, skillIds: [skillId] });

      expect(await ready(env)).toBe(false);
    });
  });

  it('RES-86 writes nothing', async () => {
    await withResumeEnv('res_summary_writes', async (env) => {
      const before = await resumeRowCounts(env.databaseUrl);

      await ready(env);
      await ready(env);

      expect(await resumeRowCounts(env.databaseUrl)).toEqual(before);
    });
  });

  it('RES-86 does not call the SkillsCatalog, while GET /resume does', async () => {
    await withResumeEnv('res_summary_catalog', async (env) => {
      const visibleIds = vi.spyOn(SkillsCatalog.prototype, 'visibleIds');
      const describe = vi.spyOn(SkillsCatalog.prototype, 'describe');
      const matchingIds = vi.spyOn(SkillsCatalog.prototype, 'matchingIds');

      await ready(env);

      expect(visibleIds).not.toHaveBeenCalled();
      expect(describe).not.toHaveBeenCalled();
      expect(matchingIds).not.toHaveBeenCalled();

      // Control: the spy sees the catalog when the route does use it.
      await call(env, env.ana, 'GET', '/resume');
      expect(describe).toHaveBeenCalled();
    });
  });
});
