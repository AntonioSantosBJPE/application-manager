import { problemDetailsSchema, profileSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { query } from '../../../../test/database.js';
import { call, resumeRowCounts, withResumeEnv, type ResumeEnv } from '../../../../test/resume.js';

const profile = (over: Record<string, unknown> = {}) => ({
  fullName: 'Pessoa Fictícia Alfa',
  headline: 'Engenheira de Software',
  email: 'alfa@exemplo.com',
  phone: null,
  location: null,
  links: [{ label: 'Site', url: 'https://exemplo.com/' }],
  summary: 'Resumo fictício.',
  locale: 'pt-BR',
  ...over,
});

const profileRows = (env: ResumeEnv) => query<{ id: string; user_id: string; full_name: string }>(env.databaseUrl, 'select id, user_id, full_name from resume.profiles order by user_id');

describe('PUT /resume/profile', () => {
  it('RES-03 creates the profile on the first save and updates the same row on the second', async () => {
    await withResumeEnv('res_profile_save', async (env) => {
      const first = await call(env, env.ana, 'PUT', '/resume/profile', profile());
      const [created] = await profileRows(env);
      const second = await call(env, env.ana, 'PUT', '/resume/profile', profile({ fullName: 'Pessoa Fictícia Beta' }));
      const rows = await profileRows(env);

      expect(first.status).toBe(200);
      expect(profileSchema.parse(await first.json()).fullName).toBe('Pessoa Fictícia Alfa');
      expect(second.status).toBe(200);
      expect(profileSchema.parse(await second.json()).fullName).toBe('Pessoa Fictícia Beta');
      expect(rows).toEqual([{ id: created!.id, user_id: env.ana.id, full_name: 'Pessoa Fictícia Beta' }]);
    });
  });

  it('RES-03 trims the texts and GET /resume shows the saved profile', async () => {
    await withResumeEnv('res_profile_trim', async (env) => {
      const response = await call(
        env,
        env.ana,
        'PUT',
        '/resume/profile',
        profile({ fullName: '  Pessoa Fictícia Alfa  ', phone: ' 81 99999-0000 ', links: [{ label: ' Site ', url: ' https://exemplo.com/ ' }] }),
      );

      expect(profileSchema.parse(await response.json())).toEqual({
        fullName: 'Pessoa Fictícia Alfa',
        headline: 'Engenheira de Software',
        email: 'alfa@exemplo.com',
        phone: '81 99999-0000',
        location: null,
        links: [{ label: 'Site', url: 'https://exemplo.com/' }],
        summary: 'Resumo fictício.',
        locale: 'pt-BR',
      });
      const read = (await (await call(env, env.ana, 'GET', '/resume')).json()) as { profile: { fullName: string } };
      expect(read.profile.fullName).toBe('Pessoa Fictícia Alfa');
    });
  });

  it('RES-04 accepts an empty name, headline, email, summary and location', async () => {
    await withResumeEnv('res_profile_empty', async (env) => {
      const response = await call(env, env.ana, 'PUT', '/resume/profile', profile({ fullName: '', headline: '', email: '', summary: '', location: '', links: [] }));

      expect(response.status).toBe(200);
      expect(profileSchema.parse(await response.json())).toMatchObject({ fullName: '', headline: '', email: '', summary: '', location: '', links: [] });
    });
  });

  it('RES-05 answers 400 with the invalid field and writes nothing for each refusal of the spec', async () => {
    await withResumeEnv('res_profile_refuse', async (env) => {
      const link = { label: 'Site', url: 'https://exemplo.com/' };
      const refusals: Array<[string, Record<string, unknown>]> = [
        ['email', profile({ email: 'sem-arroba' })],
        ['fullName', profile({ fullName: 'a'.repeat(121) })],
        ['summary', profile({ summary: 'a'.repeat(2001) })],
        ['links', profile({ links: Array.from({ length: 6 }, () => link) })],
        ['links.0.label', profile({ links: [{ label: '   ', url: 'https://exemplo.com/' }] })],
        ['links.0.url', profile({ links: [{ label: 'Site', url: 'ftp://exemplo.com/' }] })],
        ['locale', profile({ locale: 'en-US' })],
      ];

      for (const [path, body] of refusals) {
        const response = await call(env, env.ana, 'PUT', '/resume/profile', body);
        const problem = problemDetailsSchema.parse(await response.json());

        expect(response.status, path).toBe(400);
        expect(problem.errors?.map((error) => error.path), path).toContain(path);
      }
      expect((await resumeRowCounts(env.databaseUrl)).profiles).toBe(0);
    });
  });

  it('RES-06 keeps one profile per user: each member gets a row of their own', async () => {
    await withResumeEnv('res_profile_one', async (env) => {
      await call(env, env.ana, 'PUT', '/resume/profile', profile());
      await call(env, env.ana, 'PUT', '/resume/profile', profile({ headline: 'Outro título' }));
      await call(env, env.bruno, 'PUT', '/resume/profile', profile({ fullName: 'Pessoa Fictícia Beta' }));

      const rows = await profileRows(env);

      expect(rows.map((row) => row.user_id).sort()).toEqual([env.ana.id, env.bruno.id].sort());
    });
  });
});
