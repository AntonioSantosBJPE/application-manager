import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiRequestContext } from '../../../lib/call-api';
import {
  APPLICATIONS_ENDPOINTS,
  loadApplication,
  loadApplications,
  loadApplicationsCount,
  patchJobPosting,
  postApplication,
  postEvent,
  postGhostSnooze,
  postStatus,
  putSkills,
  removeApplicationById,
} from './server-functions';

const apiInternalUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const context: ApiRequestContext = {
  apiInternalUrl,
  requestId: 'req-1',
  cookie: 'am_session=token-member',
  clientIp: '203.0.113.7',
};

const applicationId = '8f6a1c2e-0000-7000-8000-000000000011';
const skillId = '8f6a1c2e-0000-7000-8000-000000000001';
const eventId = '8f6a1c2e-0000-7000-8000-000000000021';
const at = '2026-10-20T15:00:00.000Z';

const detail = {
  id: applicationId,
  status: 'saved',
  company: 'Empresa Fictícia Alfa',
  title: 'Vaga de Teste Pleno',
  level: 'mid',
  workModel: null,
  skills: [{ id: skillId, name: 'Skill Fictícia Alfa', scope: 'global', requirement: 'required', category: 'tool' }],
  createdAt: at,
  lastActivityAt: at,
  ghostSuggested: false,
  url: null,
  location: null,
  description: null,
  events: [],
};
const event = { id: eventId, kind: 'note', fromStatus: null, toStatus: null, stage: null, note: 'Nota fictícia', occurredAt: at };
const byStatus = { saved: 1, applied: 0, interviewing: 0, offer: 0, accepted: 0, rejected: 0, withdrawn: 0, ghosted: 0 };
const summary = {
  id: applicationId,
  status: 'saved',
  company: 'Empresa Fictícia Alfa',
  title: 'Vaga de Teste Pleno',
  level: 'mid',
  workModel: null,
  skills: [{ id: skillId, name: 'Skill Fictícia Alfa', scope: 'global', requirement: 'required' }],
  createdAt: at,
  lastActivityAt: at,
  ghostSuggested: false,
};
const page = {
  items: [summary],
  nextCursor: null,
  counts: { active: 1, closed: 0, byStatus },
};

/** Runs one call and collects what reached the api: method, path with query, and body. */
async function call<T>(
  run: (context: ApiRequestContext) => Promise<T>,
  respond: (request: Request) => Response | Promise<Response>,
) {
  const received: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.all(`${apiInternalUrl}/*`, async ({ request }) => {
      const text = await request.text();
      const url = new URL(request.url);
      received.push({
        method: request.method,
        path: url.pathname + url.search,
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      });
      return respond(request);
    }),
  );
  return { result: await run(context), received };
}

const problem = (status: number, title: string) => ({ type: 'about:blank', title, status });

describe('APPLICATIONS_ENDPOINTS', () => {
  it('APP-42 lists the ten routes of /applications with their methods', () => {
    expect(Object.values(APPLICATIONS_ENDPOINTS).map((e) => `${e.method} ${e.path}`)).toEqual([
      'POST /applications',
      'GET /applications',
      'GET /applications/count',
      'GET /applications/:id',
      'PATCH /applications/:id/job-posting',
      'PUT /applications/:id/skills',
      'POST /applications/:id/status',
      'POST /applications/:id/events',
      'POST /applications/:id/ghost-snooze',
      'DELETE /applications/:id',
    ]);
  });

  it('APP-42 sends each function to the method and path the table declares', async () => {
    const e = APPLICATIONS_ENDPOINTS;
    const ok = () => HttpResponse.json(detail);
    const sent = [
      (await call((c) => postApplication({ jobPosting: { company: 'A', title: 'B', level: 'mid' } }, c), () => HttpResponse.json(detail, { status: 201 }))).received[0],
      (await call((c) => loadApplications({}, c), () => HttpResponse.json(page))).received[0],
      (await call((c) => loadApplicationsCount(c), () => HttpResponse.json({ total: 3 }))).received[0],
      (await call((c) => loadApplication(applicationId, c), ok)).received[0],
      (await call((c) => patchJobPosting(applicationId, { title: 'Novo' }, c), ok)).received[0],
      (await call((c) => putSkills(applicationId, [], c), ok)).received[0],
      (await call((c) => postStatus(applicationId, { status: 'applied' }, c), ok)).received[0],
      (await call((c) => postEvent(applicationId, { kind: 'note', note: 'x' }, c), () => HttpResponse.json(event, { status: 201 }))).received[0],
      (await call((c) => postGhostSnooze(applicationId, c), ok)).received[0],
      (await call((c) => removeApplicationById(applicationId, c), () => new HttpResponse(null, { status: 204 }))).received[0],
    ].map((r) => `${r?.method} ${r?.path}`);

    const fill = (path: string) => path.replace(':id', applicationId);
    expect(sent).toEqual(
      [
        e.createApplication,
        e.listApplications,
        e.countApplications,
        e.getApplication,
        e.updateJobPosting,
        e.replaceSkills,
        e.changeStatus,
        e.addEvent,
        e.snoozeGhost,
        e.deleteApplication,
      ].map((endpoint) => `${endpoint.method} ${fill(endpoint.path)}`),
    );
  });
});

describe('applications server functions', () => {
  it('APP-42 createApplication posts the body and parses the 201 detail', async () => {
    const body = {
      jobPosting: { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid' as const },
      skills: [{ skillId, requirement: 'required' as const }],
      status: 'applied' as const,
    };
    const { result, received } = await call((c) => postApplication(body, c), () => HttpResponse.json(detail, { status: 201 }));

    expect(received).toEqual([{ method: 'POST', path: '/applications', body }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 listApplications sends every filter it was given and parses the page', async () => {
    const { result, received } = await call(
      (c) =>
        loadApplications(
          { tab: 'closed', status: 'accepted,ghosted', level: 'mid,senior', workModel: 'remote', q: 'post gres', sort: 'created', cursor: 'abc' },
          c,
        ),
      () => HttpResponse.json(page),
    );

    expect(received).toEqual([
      {
        method: 'GET',
        path: '/applications?tab=closed&status=accepted%2Cghosted&level=mid%2Csenior&workModel=remote&q=post+gres&sort=created&cursor=abc',
        body: undefined,
      },
    ]);
    expect(result).toEqual({ ok: true, data: page });
  });

  it('APP-42 listApplications sends no query string when no filter was given', async () => {
    const { received } = await call((c) => loadApplications({}, c), () => HttpResponse.json(page));

    expect(received[0]?.path).toBe('/applications');
  });

  it('APP-43 countApplications reads the total', async () => {
    const { result, received } = await call((c) => loadApplicationsCount(c), () => HttpResponse.json({ total: 3 }));

    expect(received).toEqual([{ method: 'GET', path: '/applications/count', body: undefined }]);
    expect(result).toEqual({ ok: true, data: { total: 3 } });
  });

  it('APP-42 getApplication reads one detail', async () => {
    const { result, received } = await call((c) => loadApplication(applicationId, c), () => HttpResponse.json(detail));

    expect(received).toEqual([{ method: 'GET', path: `/applications/${applicationId}`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 updateJobPosting patches the body, null included', async () => {
    const body = { title: 'Vaga de Teste Sênior', location: null };
    const { result, received } = await call((c) => patchJobPosting(applicationId, body, c), () => HttpResponse.json(detail));

    expect(received).toEqual([{ method: 'PATCH', path: `/applications/${applicationId}/job-posting`, body }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 replaceSkills puts the list itself as the body', async () => {
    const body = [{ skillId, requirement: 'nice_to_have' as const }];
    const { result, received } = await call((c) => putSkills(applicationId, body, c), () => HttpResponse.json(detail));

    expect(received).toEqual([{ method: 'PUT', path: `/applications/${applicationId}/skills`, body }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 changeStatus posts the status and the optional note', async () => {
    const body = { status: 'rejected' as const, note: 'Nota fictícia' };
    const { result, received } = await call((c) => postStatus(applicationId, body, c), () => HttpResponse.json(detail));

    expect(received).toEqual([{ method: 'POST', path: `/applications/${applicationId}/status`, body }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 addEvent posts a stage and parses the 201 event', async () => {
    const body = { kind: 'stage' as const, stage: 'hr' as const, occurredAt: at };
    const stage = { ...event, kind: 'stage', stage: 'hr', note: null };
    const { result, received } = await call((c) => postEvent(applicationId, body, c), () => HttpResponse.json(stage, { status: 201 }));

    expect(received).toEqual([{ method: 'POST', path: `/applications/${applicationId}/events`, body }]);
    expect(result).toEqual({ ok: true, data: stage });
  });

  it('APP-42 snoozeGhost posts without a body and returns the detail', async () => {
    const { result, received } = await call((c) => postGhostSnooze(applicationId, c), () => HttpResponse.json(detail));

    expect(received).toEqual([{ method: 'POST', path: `/applications/${applicationId}/ghost-snooze`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: detail });
  });

  it('APP-42 deleteApplication deletes and accepts the 204', async () => {
    const { result, received } = await call((c) => removeApplicationById(applicationId, c), () => new HttpResponse(null, { status: 204 }));

    expect(received).toEqual([{ method: 'DELETE', path: `/applications/${applicationId}`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('APP-42 escapes the ids it puts in the path', async () => {
    const { received } = await call((c) => loadApplication('a/b?c', c), () => HttpResponse.json(detail));

    expect(received[0]?.path).toBe('/applications/a%2Fb%3Fc');
  });

  it('APP-42 turns a 2xx outside the contract into 503 on every function', async () => {
    const wrong = () => HttpResponse.json({ unexpected: true });
    const outcomes = await Promise.all([
      call((c) => postApplication({ jobPosting: { company: 'A', title: 'B', level: 'mid' } }, c), () => HttpResponse.json({ unexpected: true }, { status: 201 })),
      call((c) => loadApplications({}, c), wrong),
      call((c) => loadApplicationsCount(c), wrong),
      call((c) => loadApplication(applicationId, c), wrong),
      call((c) => patchJobPosting(applicationId, { title: 'Novo' }, c), wrong),
      call((c) => putSkills(applicationId, [], c), wrong),
      call((c) => postStatus(applicationId, { status: 'applied' }, c), wrong),
      call((c) => postEvent(applicationId, { kind: 'note', note: 'x' }, c), () => HttpResponse.json({ unexpected: true }, { status: 201 })),
      call((c) => postGhostSnooze(applicationId, c), wrong),
    ]);

    expect(outcomes.map((o) => o.result)).toEqual(Array.from({ length: 9 }, () => ({ ok: false, status: 503 })));
  });

  it('APP-37 keeps the problem of a 404 so the screen can show the not found page', async () => {
    const notFound = problem(404, 'Not Found');
    const { result } = await call((c) => loadApplication(applicationId, c), () => HttpResponse.json(notFound, { status: 404 }));

    expect(result).toEqual({ ok: false, status: 404, problem: notFound });
  });

  it('APP-42 answers 503 when the api does not answer', async () => {
    const { result } = await call((c) => loadApplicationsCount(c), () => HttpResponse.error());

    expect(result).toEqual({ ok: false, status: 503 });
  });
});
