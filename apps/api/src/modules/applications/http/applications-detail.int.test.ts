import { applicationDetailSchema, problemDetailsSchema, skillSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const globalSkillId = async (env: ApplicationsEnv, key: string): Promise<string> =>
  (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;

const createApplication = async (env: ApplicationsEnv, account: ApplicationsEnv['ana'], body = applicationBody()) =>
  applicationDetailSchema.parse(await (await call(env, account, 'POST', '/applications', body)).json());

const insertEvent = (env: ApplicationsEnv, applicationId: string, columns: string, values: unknown[], occurredAt: string, createdAt: string) =>
  query(
    env.databaseUrl,
    `insert into applications.application_events (application_id, ${columns}, occurred_at, created_at)
     values ($1, ${values.map((_, index) => `$${index + 4}`).join(', ')}, $2, $3)`,
    [applicationId, occurredAt, createdAt, ...values],
  );

describe('GET /applications/:id', () => {
  it('APP-18 answers 200 with the whole posting, the skills, the status, the dates, ghostSuggested and the events', async () => {
    await withApplicationsEnv('app_detail', async (env) => {
      const node = await globalSkillId(env, 'nodejs');
      const created = await createApplication(
        env,
        env.ana,
        applicationBody(
          { url: 'https://vagas.exemplo.com/1', description: 'Texto fictício da vaga.', location: 'Recife', workModel: 'hybrid', level: 'junior' },
          { status: 'applied', skills: [{ skillId: node, requirement: 'required' }] },
        ),
      );

      const response = await call(env, env.ana, 'GET', `/applications/${created.id}`);

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body).toEqual({
        id: created.id,
        status: 'applied',
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Pleno',
        url: 'https://vagas.exemplo.com/1',
        description: 'Texto fictício da vaga.',
        level: 'junior',
        location: 'Recife',
        workModel: 'hybrid',
        skills: [{ id: node, name: 'Node.js', scope: 'global', category: 'language', requirement: 'required' }],
        createdAt: env.clock.now().toISOString(),
        lastActivityAt: env.clock.now().toISOString(),
        ghostSuggested: false,
        events: [
          {
            id: expect.any(String),
            kind: 'status_changed',
            fromStatus: null,
            toStatus: 'applied',
            stage: null,
            note: null,
            occurredAt: env.clock.now().toISOString(),
          },
        ],
      });
    });
  });

  it('APP-18 shows the optional fields of a minimal posting as null and the events as an empty list', async () => {
    await withApplicationsEnv('app_detail_min', async (env) => {
      const created = await createApplication(env, env.ana);

      const body = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());

      expect(body).toMatchObject({ url: null, description: null, location: null, workModel: null, skills: [], events: [] });
    });
  });

  it('APP-18 lists the events from the most recent to the oldest by occurred_at, a tie going to the one created later', async () => {
    await withApplicationsEnv('app_detail_events', async (env) => {
      const created = await createApplication(env, env.ana);
      await insertEvent(env, created.id, 'kind, note', ['note', 'antiga'], '2026-10-01T12:00:00Z', '2026-11-03T12:00:01Z');
      await insertEvent(env, created.id, 'kind, stage', ['stage', 'hr'], '2026-10-20T12:00:00Z', '2026-11-03T12:00:02Z');
      await insertEvent(env, created.id, 'kind, note', ['note', 'empate criada antes'], '2026-10-10T12:00:00Z', '2026-11-03T12:00:03Z');
      await insertEvent(env, created.id, 'kind, note', ['note', 'empate criada depois'], '2026-10-10T12:00:00Z', '2026-11-03T12:00:04Z');
      await insertEvent(env, created.id, 'kind, to_status, from_status', ['status_changed', 'applied', 'saved'], '2026-10-25T12:00:00Z', '2026-11-03T12:00:05Z');

      const body = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());

      expect(body.events.map((event) => event.occurredAt)).toEqual([
        '2026-10-25T12:00:00.000Z',
        '2026-10-20T12:00:00.000Z',
        '2026-10-10T12:00:00.000Z',
        '2026-10-10T12:00:00.000Z',
        '2026-10-01T12:00:00.000Z',
      ]);
      expect(body.events.map((event) => event.note ?? event.stage ?? event.toStatus)).toEqual([
        'applied',
        'hr',
        'empate criada depois',
        'empate criada antes',
        'antiga',
      ]);
      expect(body.events[0]).toMatchObject({ kind: 'status_changed', fromStatus: 'saved', toStatus: 'applied' });
    });
  });

  it('APP-19 answers 404 in Problem Details for an id that is not a uuid, that does not exist or that belongs to another account', async () => {
    await withApplicationsEnv('app_detail_404', async (env) => {
      const brunos = await createApplication(env, env.bruno);

      for (const id of ['not-a-uuid', '0195f3a0-0000-7000-8000-00000000dead', brunos.id]) {
        const response = await call(env, env.ana, 'GET', `/applications/${id}`);

        expect(response.status, id).toBe(404);
        expect(response.headers.get('content-type'), id).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, id).toBe(404);
      }
      // The owner still reads it, so the 404 above was the isolation and not a broken route.
      expect((await call(env, env.bruno, 'GET', `/applications/${brunos.id}`)).status).toBe(200);
    });
  });

  it('APP-88 shows a promoted skill with the same id and scope global', async () => {
    await withApplicationsEnv('app_detail_promoted', async (env) => {
      const own = skillSchema.parse(await (await call(env, env.ana, 'POST', '/skills', { name: 'Skill Fictícia Alfa', category: 'tool' })).json());
      const created = await createApplication(env, env.ana, applicationBody({}, { skills: [{ skillId: own.id, requirement: 'nice_to_have' }] }));
      expect(created.skills).toEqual([{ id: own.id, name: 'Skill Fictícia Alfa', scope: 'private', category: 'tool', requirement: 'nice_to_have' }]);

      const promoted = await call(env, env.admin, 'POST', `/skills/${own.id}/promote`);
      expect(promoted.status).toBe(200);

      const body = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());
      expect(body.id).toBe(created.id);
      expect(body.skills).toEqual([{ id: own.id, name: 'Skill Fictícia Alfa', scope: 'global', category: 'tool', requirement: 'nice_to_have' }]);
    });
  });
});
