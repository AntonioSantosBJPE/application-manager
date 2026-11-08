import { applicationDetailSchema, applicationEventSchema, problemDetailsSchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { applicationBody, call, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const createApplication = async (env: ApplicationsEnv, status = 'applied') =>
  applicationDetailSchema.parse(await (await call(env, env.ana, 'POST', '/applications', applicationBody({}, { status }))).json());

const addEvent = (env: ApplicationsEnv, id: string, body: unknown) => call(env, env.ana, 'POST', `/applications/${id}/events`, body);

const eventRows = (env: ApplicationsEnv, applicationId: string) =>
  query<{ kind: string; stage: string | null; note: string | null; from_status: string | null; to_status: string | null; occurred_at: Date }>(
    env.databaseUrl,
    `select kind, stage, note, from_status, to_status, occurred_at from applications.application_events
      where application_id = $1 and kind <> 'status_changed' order by id`,
    [applicationId],
  );

const lastActivity = async (env: ApplicationsEnv, id: string) =>
  (await query<{ last_activity_at: Date }>(env.databaseUrl, 'select last_activity_at from applications.applications where id = $1', [id]))[0]!
    .last_activity_at;

describe('POST /applications/:id/events', () => {
  it('APP-23 records a stage with its note and the date sent, and answers 201 with the event', async () => {
    await withApplicationsEnv('app_event_stage', async (env) => {
      const created = await createApplication(env);
      env.clock.advance(10 * DAY_MS);

      const response = await addEvent(env, created.id, {
        kind: 'stage',
        stage: 'technical',
        note: 'Conversa fictícia com a equipe.',
        occurredAt: '2026-11-05T15:30:00.000Z',
      });

      expect(response.status).toBe(201);
      expect(applicationEventSchema.parse(await response.json())).toEqual({
        id: expect.any(String),
        kind: 'stage',
        fromStatus: null,
        toStatus: null,
        stage: 'technical',
        note: 'Conversa fictícia com a equipe.',
        occurredAt: '2026-11-05T15:30:00.000Z',
      });
      expect(await eventRows(env, created.id)).toEqual([
        { kind: 'stage', stage: 'technical', note: 'Conversa fictícia com a equipe.', from_status: null, to_status: null, occurred_at: new Date('2026-11-05T15:30:00.000Z') },
      ]);
    });
  });

  it('APP-23 records a stage without a note and a note without a date, the date being the clock now', async () => {
    await withApplicationsEnv('app_event_defaults', async (env) => {
      const created = await createApplication(env);
      env.clock.advance(2 * DAY_MS);

      const stage = await addEvent(env, created.id, { kind: 'stage', stage: 'hr' });
      const note = await addEvent(env, created.id, { kind: 'note', note: 'Lembrar de perguntar sobre o time.' });

      expect(stage.status).toBe(201);
      expect(note.status).toBe(201);
      expect(applicationEventSchema.parse(await stage.json())).toMatchObject({ kind: 'stage', stage: 'hr', note: null, occurredAt: env.clock.now().toISOString() });
      expect(applicationEventSchema.parse(await note.json())).toMatchObject({
        kind: 'note',
        stage: null,
        note: 'Lembrar de perguntar sobre o time.',
        occurredAt: env.clock.now().toISOString(),
      });
      const detail = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());
      expect(detail.events.map((event) => event.kind).sort()).toEqual(['note', 'stage', 'status_changed']);
    });
  });

  it('APP-23 accepts every stage of the enum', async () => {
    await withApplicationsEnv('app_event_stages', async (env) => {
      const created = await createApplication(env);

      for (const stage of ['screening', 'hr', 'technical', 'case', 'other']) {
        expect((await addEvent(env, created.id, { kind: 'stage', stage })).status, stage).toBe(201);
      }
    });
  });

  it('APP-24 an event dated before the activity leaves last_activity_at as it was', async () => {
    await withApplicationsEnv('app_event_activity_past', async (env) => {
      const created = await createApplication(env);
      env.clock.advance(5 * DAY_MS);
      const activity = await lastActivity(env, created.id);

      const response = await addEvent(env, created.id, { kind: 'stage', stage: 'hr', occurredAt: new Date(activity.getTime() - 2 * DAY_MS).toISOString() });

      expect(response.status).toBe(201);
      expect((await lastActivity(env, created.id)).toISOString()).toBe(activity.toISOString());
      const detail = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${created.id}`)).json());
      expect(detail.lastActivityAt).toBe(activity.toISOString());
    });
  });

  it('APP-24 an event dated after the activity moves last_activity_at to its date, and an event dated now moves it to now', async () => {
    await withApplicationsEnv('app_event_activity_later', async (env) => {
      const created = await createApplication(env);
      env.clock.advance(5 * DAY_MS);
      const dated = new Date(env.clock.now().getTime() - 1 * DAY_MS);

      await addEvent(env, created.id, { kind: 'note', note: 'Nota datada de ontem.', occurredAt: dated.toISOString() });

      expect((await lastActivity(env, created.id)).toISOString()).toBe(dated.toISOString());

      env.clock.advance(2 * DAY_MS);
      await addEvent(env, created.id, { kind: 'note', note: 'Nota de agora.' });

      expect((await lastActivity(env, created.id)).toISOString()).toBe(env.clock.now().toISOString());
    });
  });

  it('APP-25 answers 400 for a status_changed kind, a stage that is missing or unknown, a missing or empty note, a note over 2000 characters or a malformed date, and writes nothing', async () => {
    await withApplicationsEnv('app_event_invalid', async (env) => {
      const created = await createApplication(env);
      const before = await lastActivity(env, created.id);
      const invalid: Array<[string, unknown]> = [
        ['kind status_changed', { kind: 'status_changed', toStatus: 'offer' }],
        ['kind status_changed with a stage', { kind: 'status_changed', stage: 'hr' }],
        ['unknown kind', { kind: 'meeting', note: 'x' }],
        ['no kind', { note: 'x' }],
        ['stage missing', { kind: 'stage' }],
        ['stage unknown', { kind: 'stage', stage: 'final' }],
        ['stage with a note over 2000', { kind: 'stage', stage: 'hr', note: 'n'.repeat(2001) }],
        ['note missing', { kind: 'note' }],
        ['note empty', { kind: 'note', note: '' }],
        ['note blank', { kind: 'note', note: '   ' }],
        ['note over 2000', { kind: 'note', note: 'n'.repeat(2001) }],
        ['date not iso', { kind: 'note', note: 'x', occurredAt: 'ontem' }],
      ];

      for (const [name, body] of invalid) {
        const response = await addEvent(env, created.id, body);

        expect(response.status, name).toBe(400);
        expect(response.headers.get('content-type'), name).toContain('application/problem+json');
        expect(problemDetailsSchema.parse(await response.json()).status, name).toBe(400);
      }
      expect(await eventRows(env, created.id)).toEqual([]);
      expect((await lastActivity(env, created.id)).toISOString()).toBe(before.toISOString());
    });
  });

  it('APP-25 accepts a note of exactly 2000 characters', async () => {
    await withApplicationsEnv('app_event_note_max', async (env) => {
      const created = await createApplication(env);

      expect((await addEvent(env, created.id, { kind: 'note', note: 'n'.repeat(2000) })).status).toBe(201);
    });
  });

  it('APP-25 accepts a date exactly 5 minutes ahead of the clock and refuses one 5 minutes and 1 millisecond ahead', async () => {
    await withApplicationsEnv('app_event_future', async (env) => {
      const created = await createApplication(env);
      const limit = env.clock.now().getTime() + 5 * MINUTE_MS;

      const refused = await addEvent(env, created.id, { kind: 'note', note: 'Um milissegundo além.', occurredAt: new Date(limit + 1).toISOString() });

      expect(refused.status).toBe(400);
      expect(problemDetailsSchema.parse(await refused.json()).errors).toEqual([{ path: 'occurredAt', code: 'too_far_in_future' }]);
      expect(await eventRows(env, created.id)).toEqual([]);

      const accepted = await addEvent(env, created.id, { kind: 'note', note: 'Exatamente no limite.', occurredAt: new Date(limit).toISOString() });

      expect(accepted.status).toBe(201);
      expect(applicationEventSchema.parse(await accepted.json()).occurredAt).toBe(new Date(limit).toISOString());
      expect(await eventRows(env, created.id)).toHaveLength(1);
      // The refused date left no trace in the activity: only the accepted one, which is the later date, moved it.
      expect((await lastActivity(env, created.id)).getTime()).toBe(limit);
    });
  });

  it('APP-25 a date 5 minutes ahead is judged by the clock when the request arrives, not by a fixed instant', async () => {
    await withApplicationsEnv('app_event_future_clock', async (env) => {
      const created = await createApplication(env);
      const date = new Date(env.clock.now().getTime() + 6 * MINUTE_MS).toISOString();

      expect((await addEvent(env, created.id, { kind: 'note', note: 'Seis minutos adiante.', occurredAt: date })).status).toBe(400);

      env.clock.advance(MINUTE_MS);

      expect((await addEvent(env, created.id, { kind: 'note', note: 'Seis minutos adiante.', occurredAt: date })).status).toBe(201);
    });
  });

  it('APP-26 offers no route that edits or deletes an event: PATCH, PUT and DELETE answer 404 and the event stays', async () => {
    await withApplicationsEnv('app_event_immutable', async (env) => {
      const created = await createApplication(env);
      const event = applicationEventSchema.parse(
        await (await addEvent(env, created.id, { kind: 'note', note: 'Texto original.' })).json(),
      );
      const before = await eventRows(env, created.id);
      const targets = [`/applications/${created.id}/events/${event.id}`, `/applications/${created.id}/events`, `/events/${event.id}`];

      for (const method of ['PATCH', 'PUT', 'DELETE']) {
        for (const path of targets) {
          const response = await call(env, env.ana, method, path, method === 'DELETE' ? undefined : { note: 'Texto trocado.' });

          expect(response.status, `${method} ${path}`).toBe(404);
        }
      }
      expect(await eventRows(env, created.id)).toEqual(before);
    });
  });
});
