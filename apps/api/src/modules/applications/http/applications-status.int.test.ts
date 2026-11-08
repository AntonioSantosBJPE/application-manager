import { FUNNEL_ORDER, applicationDetailSchema, type ApplicationStatus } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, seedApplication, seedApplications, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const createApplication = async (env: ApplicationsEnv, body = applicationBody()) =>
  applicationDetailSchema.parse(await (await call(env, env.ana, 'POST', '/applications', body)).json());

const changeStatus = (env: ApplicationsEnv, id: string, status: string, note?: string) =>
  call(env, env.ana, 'POST', `/applications/${id}/status`, note === undefined ? { status } : { status, note });

const events = (env: ApplicationsEnv, applicationId: string) =>
  query<{ kind: string; from_status: string | null; to_status: string | null; note: string | null; occurred_at: Date }>(
    env.databaseUrl,
    'select kind, from_status, to_status, note, occurred_at from applications.application_events where application_id = $1 order by id',
    [applicationId],
  );

const stored = async (env: ApplicationsEnv, applicationId: string) =>
  (await query<{ status: string; last_activity_at: Date }>(env.databaseUrl, 'select status, last_activity_at from applications.applications where id = $1', [applicationId]))[0]!;

describe('POST /applications/:id/status', () => {
  it('APP-20 changes the status, records from, to, the note and the date of the clock, moves the activity and answers 200', async () => {
    await withApplicationsEnv('app_status', async (env) => {
      const created = await createApplication(env);
      env.clock.advance(2 * DAY_MS);

      const response = await changeStatus(env, created.id, 'applied', 'Enviei pelo site da empresa.');

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body.status).toBe('applied');
      expect(body.lastActivityAt).toBe(env.clock.now().toISOString());
      expect(body.events).toEqual([
        {
          id: expect.any(String),
          kind: 'status_changed',
          fromStatus: 'saved',
          toStatus: 'applied',
          stage: null,
          note: 'Enviei pelo site da empresa.',
          occurredAt: env.clock.now().toISOString(),
        },
      ]);
      expect(await stored(env, created.id)).toEqual({ status: 'applied', last_activity_at: env.clock.now() });
      expect(await events(env, created.id)).toEqual([
        { kind: 'status_changed', from_status: 'saved', to_status: 'applied', note: 'Enviei pelo site da empresa.', occurred_at: env.clock.now() },
      ]);
    });
  });

  it('APP-20 records a change without a note with a null note', async () => {
    await withApplicationsEnv('app_status_nonote', async (env) => {
      const created = await createApplication(env);

      await changeStatus(env, created.id, 'applied');

      expect((await events(env, created.id)).map((event) => event.note)).toEqual([null]);
    });
  });

  it('APP-21 accepts a change from any of the eight statuses to any other, forward, backward and between final ones', async () => {
    await withApplicationsEnv('app_status_all', async (env) => {
      const pairs = FUNNEL_ORDER.flatMap((from) => FUNNEL_ORDER.filter((to) => to !== from).map((to) => ({ from, to })));
      const ids = await seedApplications(
        env.databaseUrl,
        pairs.map(({ from }) => ({ userId: env.ana.id, status: from })),
      );

      expect(pairs).toHaveLength(56);
      for (const [index, { from, to }] of pairs.entries()) {
        const response = await changeStatus(env, ids[index]!, to);

        expect(response.status, `${from} -> ${to}`).toBe(200);
        const body = applicationDetailSchema.parse(await response.json());
        expect(body.status, `${from} -> ${to}`).toBe(to);
        expect(body.events.map((event) => [event.fromStatus, event.toStatus]), `${from} -> ${to}`).toEqual([[from, to]]);
      }
    });
  });

  it('APP-21 walks one application forward through the funnel, back to an earlier status and from one final status to another', async () => {
    await withApplicationsEnv('app_status_walk', async (env) => {
      const created = await createApplication(env);
      const walk: ApplicationStatus[] = ['applied', 'interviewing', 'offer', 'accepted', 'interviewing', 'rejected', 'ghosted', 'saved'];

      for (const status of walk) {
        env.clock.advance(DAY_MS);
        expect((await changeStatus(env, created.id, status)).status, status).toBe(200);
      }

      const trail = (await events(env, created.id)).map((event) => [event.from_status, event.to_status]);
      expect(trail).toEqual([
        ['saved', 'applied'],
        ['applied', 'interviewing'],
        ['interviewing', 'offer'],
        ['offer', 'accepted'],
        ['accepted', 'interviewing'],
        ['interviewing', 'rejected'],
        ['rejected', 'ghosted'],
        ['ghosted', 'saved'],
      ]);
      expect((await stored(env, created.id)).status).toBe('saved');
    });
  });

  it('APP-22 answers 200 with no event and the activity untouched when the status is the one it already has', async () => {
    await withApplicationsEnv('app_status_same', async (env) => {
      const created = await createApplication(env, applicationBody({}, { status: 'applied' }));
      const eventsBefore = await events(env, created.id);
      env.clock.advance(3 * DAY_MS);

      const response = await changeStatus(env, created.id, 'applied', 'Uma nota que não vira evento.');

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body.status).toBe('applied');
      expect(body.lastActivityAt).toBe(created.lastActivityAt);
      expect(body.events).toHaveLength(1);
      expect(await events(env, created.id)).toEqual(eventsBefore);
      expect((await stored(env, created.id)).last_activity_at.toISOString()).toBe(created.lastActivityAt);
    });
  });

  it('APP-22 a saved application asked for saved has no event at all afterwards', async () => {
    await withApplicationsEnv('app_status_same_saved', async (env) => {
      const id = await seedApplication(env.databaseUrl, { userId: env.ana.id, status: 'saved' });

      expect((await changeStatus(env, id, 'saved')).status).toBe(200);

      expect(await events(env, id)).toEqual([]);
    });
  });

  it('APP-27 two changes at the same time are written one after the other, the from of the second being the status the first left', async () => {
    await withApplicationsEnv('app_status_race', async (env) => {
      // Ten applications, each changed by two real parallel requests, so a missing lock shows as two events with the same `from`.
      const ids = await seedApplications(
        env.databaseUrl,
        Array.from({ length: 10 }, () => ({ userId: env.ana.id, status: 'saved' })),
      );

      const responses = await Promise.all(
        ids.flatMap((id) => [changeStatus(env, id, 'applied'), changeStatus(env, id, 'interviewing')]),
      );

      expect(responses.map((response) => response.status)).toEqual(Array.from({ length: 20 }, () => 200));
      for (const id of ids) {
        const trail = await events(env, id);
        expect(trail).toHaveLength(2);
        const [first, second] = trail.map((event) => ({ from: event.from_status, to: event.to_status }));
        expect(first!.from).toBe('saved');
        expect(second!.from).toBe(first!.to);
        expect(new Set([first!.to, second!.to])).toEqual(new Set(['applied', 'interviewing']));
        expect((await stored(env, id)).status).toBe(second!.to);
      }
    });
  });
});
