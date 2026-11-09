import { applicationDetailSchema, applicationsPageSchema, type ApplicationStatus } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { call, seedApplication, withApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** The instant the clock of the environment starts at, and the last activity of every seeded application. */
const START = new Date('2026-11-03T12:00:00.000Z');

const seed = (env: ApplicationsEnv, status: ApplicationStatus) =>
  seedApplication(env.databaseUrl, { userId: env.ana.id, status, createdAt: START.toISOString(), lastActivityAt: START.toISOString() });

/** What the detail and the list say about the application at the clock's current instant. */
const suggestions = async (env: ApplicationsEnv, id: string, tab: 'active' | 'closed' = 'active') => {
  await keepSignedIn(env);
  const detail = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${id}`)).json());
  const page = applicationsPageSchema.parse(await (await call(env, env.ana, 'GET', `/applications?tab=${tab}`)).json());
  return { detail: detail.ghostSuggested, list: page.items.find((item) => item.id === id)?.ghostSuggested };
};

/** The clock jumps weeks ahead, far past a session's own life, so the sessions are kept alive and only the 504 h rule is under test. */
const keepSignedIn = (env: ApplicationsEnv) => query(env.databaseUrl, "update identity.sessions set expires_at = '2100-01-01T00:00:00Z'");

const snooze = (env: ApplicationsEnv, id: string) => call(env, env.ana, 'POST', `/applications/${id}/ghost-snooze`);

const stored = async (env: ApplicationsEnv, id: string) =>
  (
    await query<{ status: string; last_activity_at: Date; ghost_snoozed_until: Date | null; events: number }>(
      env.databaseUrl,
      `select a.status, a.last_activity_at, a.ghost_snoozed_until,
              (select count(*)::int from applications.application_events e where e.application_id = a.id) as events
         from applications.applications a where a.id = $1`,
      [id],
    )
  )[0]!;

describe('the ghost suggestion', () => {
  it('APP-32 is false 504 h minus 1 minute after the last activity and true at 504 h, for applied and interviewing, in the list and in the detail', async () => {
    await withApplicationsEnv('app_ghost_edge', async (env) => {
      for (const status of ['applied', 'interviewing'] as const) {
        const id = await seed(env, status);

        env.clock.set(new Date(START.getTime() + 504 * HOUR_MS - MINUTE_MS));
        expect(await suggestions(env, id), `${status} 1 minute short`).toEqual({ detail: false, list: false });

        env.clock.set(new Date(START.getTime() + 504 * HOUR_MS));
        expect(await suggestions(env, id), `${status} at 504 h`).toEqual({ detail: true, list: true });

        env.clock.set(new Date(START.getTime() + 504 * HOUR_MS + MINUTE_MS));
        expect(await suggestions(env, id), `${status} 1 minute over`).toEqual({ detail: true, list: true });
      }
    });
  });

  it('APP-32 counts the 504 hours from the last activity, so a new event restarts them', async () => {
    await withApplicationsEnv('app_ghost_restart', async (env) => {
      const id = await seed(env, 'applied');
      env.clock.set(new Date(START.getTime() + 30 * DAY_MS));
      expect((await suggestions(env, id)).detail).toBe(true);

      await keepSignedIn(env);
      await call(env, env.ana, 'POST', `/applications/${id}/events`, { kind: 'note', note: 'Falei com o recrutador.' });

      expect(await suggestions(env, id)).toEqual({ detail: false, list: false });
      env.clock.advance(504 * HOUR_MS - MINUTE_MS);
      expect((await suggestions(env, id)).detail).toBe(false);
      env.clock.advance(MINUTE_MS);
      expect(await suggestions(env, id)).toEqual({ detail: true, list: true });
    });
  });

  it('APP-33 is false before 504 h and for every status other than applied and interviewing, however old the activity', async () => {
    await withApplicationsEnv('app_ghost_false', async (env) => {
      const others: ApplicationStatus[] = ['saved', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'];
      const ids = await Promise.all(others.map((status) => seed(env, status)));
      const recent = await seed(env, 'applied');
      env.clock.set(new Date(START.getTime() + 100 * DAY_MS));

      for (const [index, status] of others.entries()) {
        const tab = status === 'saved' || status === 'offer' ? 'active' : 'closed';
        expect(await suggestions(env, ids[index]!, tab), status).toEqual({ detail: false, list: false });
      }
      // The control: the same age makes an applied application suggested.
      expect((await suggestions(env, recent)).detail).toBe(true);
    });
  });

  it('APP-33 is false while the snooze is in force and true again at the instant it ends', async () => {
    await withApplicationsEnv('app_ghost_snoozed', async (env) => {
      const id = await seed(env, 'interviewing');
      env.clock.set(new Date(START.getTime() + 40 * DAY_MS));
      const until = new Date(env.clock.now().getTime() + 21 * DAY_MS);
      await query(env.databaseUrl, 'update applications.applications set ghost_snoozed_until = $2 where id = $1', [id, until.toISOString()]);

      env.clock.set(new Date(until.getTime() - 1));
      expect(await suggestions(env, id), 'one millisecond before').toEqual({ detail: false, list: false });

      env.clock.set(until);
      expect(await suggestions(env, id), 'at the instant').toEqual({ detail: true, list: true });
    });
  });

  it('APP-34 never changes a status because of time: 60 days later a read leaves the status, the events and the activity as they were', async () => {
    await withApplicationsEnv('app_ghost_time', async (env) => {
      const id = await seed(env, 'applied');
      const before = await stored(env, id);
      env.clock.set(new Date(START.getTime() + 60 * DAY_MS));

      const { detail, list } = await suggestions(env, id);
      await keepSignedIn(env);
      const read = applicationDetailSchema.parse(await (await call(env, env.ana, 'GET', `/applications/${id}`)).json());

      expect({ detail, list }).toEqual({ detail: true, list: true });
      expect(read.status).toBe('applied');
      expect(await stored(env, id)).toEqual(before);
    });
  });

  it('APP-35 snoozing stores now plus 21 days, writes no event, keeps the activity and answers 200 with ghostSuggested false', async () => {
    await withApplicationsEnv('app_ghost_snooze', async (env) => {
      const id = await seed(env, 'applied');
      env.clock.set(new Date(START.getTime() + 25 * DAY_MS));
      expect((await suggestions(env, id)).detail).toBe(true);
      const before = await stored(env, id);
      await keepSignedIn(env);

      const response = await snooze(env, id);

      expect(response.status).toBe(200);
      const body = applicationDetailSchema.parse(await response.json());
      expect(body).toMatchObject({ id, status: 'applied', ghostSuggested: false, lastActivityAt: START.toISOString(), events: [] });
      expect(await stored(env, id)).toEqual({
        ...before,
        ghost_snoozed_until: new Date(env.clock.now().getTime() + 21 * DAY_MS),
        events: 0,
      });
      expect(await suggestions(env, id)).toEqual({ detail: false, list: false });
    });
  });

  it('APP-35 the suggestion comes back when the snooze ends, and snoozing again hides it for 21 more days', async () => {
    await withApplicationsEnv('app_ghost_snooze_back', async (env) => {
      const id = await seed(env, 'applied');
      env.clock.set(new Date(START.getTime() + 25 * DAY_MS));
      await keepSignedIn(env);
      await snooze(env, id);

      env.clock.advance(21 * DAY_MS - 1);
      expect(await suggestions(env, id), '1 ms before it ends').toEqual({ detail: false, list: false });

      env.clock.advance(1);
      expect(await suggestions(env, id), 'when it ends').toEqual({ detail: true, list: true });

      await keepSignedIn(env);
      const again = applicationDetailSchema.parse(await (await snooze(env, id)).json());
      expect(again.ghostSuggested).toBe(false);
      expect((await stored(env, id)).ghost_snoozed_until).toEqual(new Date(env.clock.now().getTime() + 21 * DAY_MS));
    });
  });
});
