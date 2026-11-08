import type {
  ApplicationDetail,
  ApplicationEvent,
  ApplicationStatus,
  CreateEventRequest,
  ReplaceSkillsRequest,
  UpdateJobPostingRequest,
} from '@am/contracts';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';
import { apiInternalUrl, problem } from './api';
import { NOW, uuid } from './fixtures';

export type DetailEndpoint = 'load' | 'status' | 'posting' | 'skills' | 'event' | 'snooze' | 'remove';

export interface FakeDetailOptions {
  /** The names `PUT /applications/:id/skills` answers for the skill ids it receives. */
  skillNames?: Record<string, string>;
}

const byDateDescending = (a: ApplicationEvent, b: ApplicationEvent) => b.occurredAt.localeCompare(a.occurredAt);

/**
 * The detail endpoints of the applications api, with state, for one application: the status, the
 * posting fields, the skills and the events change the way the api changes them, so the screen reads
 * back what it wrote. A status writes a `status_changed` event at `NOW`, a stage keeps the `occurredAt`
 * it was sent with, a note is `NOW`; events come back newest first. `calls` lists every request as
 * `METHOD /path body`, `fail(name, status)` makes the next call of an endpoint answer with that error and
 * `hold(name)` keeps an answer until the returned function runs.
 */
export function fakeDetail(server: SetupServer, initial: ApplicationDetail, options: FakeDetailOptions = {}) {
  let current: ApplicationDetail = { ...initial, events: [...initial.events].sort(byDateDescending) };
  let removed = false;
  let nextEvent = 5000;
  const calls: string[] = [];
  const holds = new Map<string, Promise<void>>();
  const failures = new Map<string, { status: number; errors?: { path: string; code: string }[] }>();

  const failed = (name: DetailEndpoint) => {
    const failure = failures.get(name);
    if (failure === undefined) return undefined;
    failures.delete(name);
    return problem(failure.status, failure.errors);
  };
  const wait = async (name: DetailEndpoint) => {
    await holds.get(name);
  };
  const touch = (at: string) => {
    if (at > current.lastActivityAt) current = { ...current, lastActivityAt: at };
  };
  const addEvent = (event: Omit<ApplicationEvent, 'id'>): ApplicationEvent => {
    const created = { id: uuid(nextEvent++), ...event };
    current = { ...current, events: [created, ...current.events].sort(byDateDescending) };
    touch(created.occurredAt);
    return created;
  };
  const path = (suffix = '') => `${apiInternalUrl}/applications/${initial.id}${suffix}`;

  server.use(
    http.get(path(), async () => {
      calls.push(`GET /applications/${initial.id}`);
      await wait('load');
      const error = failed('load');
      if (error !== undefined) return error;
      return removed ? problem(404) : HttpResponse.json(current);
    }),
    http.post(path('/status'), async ({ request }) => {
      const body = (await request.json()) as { status: ApplicationStatus };
      calls.push(`POST /applications/${initial.id}/status ${JSON.stringify(body)}`);
      await wait('status');
      const error = failed('status');
      if (error !== undefined) return error;
      if (body.status !== current.status) {
        addEvent({
          kind: 'status_changed',
          fromStatus: current.status,
          toStatus: body.status,
          stage: null,
          note: null,
          occurredAt: NOW.toISOString(),
        });
        current = { ...current, status: body.status, ghostSuggested: false };
      }
      return HttpResponse.json(current);
    }),
    http.patch(path('/job-posting'), async ({ request }) => {
      const body = (await request.json()) as UpdateJobPostingRequest;
      calls.push(`PATCH /applications/${initial.id}/job-posting ${JSON.stringify(body)}`);
      await wait('posting');
      const error = failed('posting');
      if (error !== undefined) return error;
      const { description, level, location, url, workModel, company, title } = body;
      current = {
        ...current,
        ...(company === undefined ? {} : { company }),
        ...(title === undefined ? {} : { title }),
        ...(level === undefined ? {} : { level }),
        ...(workModel === undefined ? {} : { workModel }),
        ...(location === undefined ? {} : { location }),
        ...(url === undefined ? {} : { url }),
        ...(description === undefined ? {} : { description }),
      };
      return HttpResponse.json(current);
    }),
    http.put(path('/skills'), async ({ request }) => {
      const body = (await request.json()) as ReplaceSkillsRequest;
      calls.push(`PUT /applications/${initial.id}/skills ${JSON.stringify(body)}`);
      await wait('skills');
      const error = failed('skills');
      if (error !== undefined) return error;
      current = {
        ...current,
        skills: body.map((skill) => {
          const known = current.skills.find((item) => item.id === skill.skillId);
          return {
            id: skill.skillId,
            name: known?.name ?? options.skillNames?.[skill.skillId] ?? skill.skillId,
            scope: known?.scope ?? ('global' as const),
            category: known?.category ?? ('tool' as const),
            requirement: skill.requirement,
          };
        }),
      };
      return HttpResponse.json(current);
    }),
    http.post(path('/events'), async ({ request }) => {
      const body = (await request.json()) as CreateEventRequest;
      calls.push(`POST /applications/${initial.id}/events ${JSON.stringify(body)}`);
      await wait('event');
      const error = failed('event');
      if (error !== undefined) return error;
      const event = addEvent({
        kind: body.kind,
        fromStatus: null,
        toStatus: null,
        stage: body.kind === 'stage' ? body.stage : null,
        note: body.note ?? null,
        occurredAt: body.occurredAt ?? NOW.toISOString(),
      });
      return HttpResponse.json(event, { status: 201 });
    }),
    http.post(path('/ghost-snooze'), async () => {
      calls.push(`POST /applications/${initial.id}/ghost-snooze`);
      await wait('snooze');
      const error = failed('snooze');
      if (error !== undefined) return error;
      current = { ...current, ghostSuggested: false };
      return HttpResponse.json(current);
    }),
    http.delete(path(), async () => {
      calls.push(`DELETE /applications/${initial.id}`);
      await wait('remove');
      const error = failed('remove');
      if (error !== undefined) return error;
      removed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    calls,
    /** The application as the api holds it now. */
    get current() {
      return current;
    },
    get removed() {
      return removed;
    },
    /** Calls of one endpoint, such as `callsTo('POST', '/status')`. */
    callsTo: (method: string, part: string) => calls.filter((call) => call.startsWith(method) && call.includes(part)),
    hold(name: DetailEndpoint): () => void {
      let release: () => void = () => undefined;
      holds.set(
        name,
        new Promise<void>((resolve) => {
          release = () => {
            holds.delete(name);
            resolve();
          };
        }),
      );
      return release;
    },
    /** The next call of the endpoint answers with this status as Problem Details, naming the fields in `errors`. */
    fail(name: DetailEndpoint, status: number, errors?: { path: string; code: string }[]) {
      failures.set(name, { status, errors });
    },
  };
}
