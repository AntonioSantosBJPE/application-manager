import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiRequestContext } from '../../../lib/call-api';
import * as serverFunctions from './server-functions';
import {
  loadResume,
  loadResumeSummary,
  patchBullet,
  patchResumeItem,
  postBullet,
  postResumeItem,
  putBulletsOrder,
  putItemsOrder,
  putProfile,
  removeBullet,
  removeResumeItem,
  RESUME_ENDPOINTS,
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

const itemId = '8f6a1c2e-0000-7000-8000-000000000011';
const otherItemId = '8f6a1c2e-0000-7000-8000-000000000012';
const bulletId = '8f6a1c2e-0000-7000-8000-000000000021';
const skillId = '8f6a1c2e-0000-7000-8000-000000000001';

const profile = {
  fullName: 'Pessoa Fictícia Alfa',
  headline: 'Título Fictício',
  email: 'alfa@exemplo.com',
  phone: null,
  location: null,
  links: [{ label: 'Site', url: 'https://exemplo.com/alfa' }],
  summary: 'Resumo fictício.',
  locale: 'pt-BR',
};
const bullet = { id: bulletId, text: 'Texto fictício de bullet.', skillIds: [skillId] };
const skills = { [skillId]: { name: 'Skill Fictícia Alfa', scope: 'global' } };
const resume = {
  profile,
  experiences: [
    { id: itemId, role: 'Cargo Fictício', company: 'Empresa Fictícia Alfa', location: null, startDate: '2023-03', endDate: null, bullets: [bullet] },
  ],
  projects: [],
  educations: [],
  certifications: [],
  languages: [],
  skills,
};
const experience = { id: itemId, role: 'Cargo Fictício', company: 'Empresa Fictícia Alfa', location: null, startDate: '2023-03', endDate: null };
const project = { id: itemId, name: 'Projeto Fictício', url: null, description: null };
const education = { id: itemId, course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2019-02', endDate: '2022-12' };
const certification = { id: itemId, name: 'Certificação Fictícia', issuer: null, issuedOn: '2024-05', url: null };
const language = { id: itemId, language: 'Inglês', level: 'advanced' };
const bulletResponse = { bullet, skills };

/** Runs one call and collects what reached the api: method, path and body. */
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
const noContent = () => new HttpResponse(null, { status: 204 });

describe('RESUME_ENDPOINTS', () => {
  it('RES-86 lists the eleven endpoints of /resume with their methods', () => {
    expect(Object.values(RESUME_ENDPOINTS).map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /resume',
      'GET /resume/summary',
      'PUT /resume/profile',
      'POST /resume/:section',
      'PATCH /resume/:section/:id',
      'DELETE /resume/:section/:id',
      'PUT /resume/:section/order',
      'POST /resume/:section/:id/bullets',
      'PATCH /resume/:section/:id/bullets/:bulletId',
      'DELETE /resume/:section/:id/bullets/:bulletId',
      'PUT /resume/:section/:id/bullets/order',
    ]);
  });

  it('RES-86 has a server function named by each of the eleven endpoints', () => {
    const names = Object.keys(RESUME_ENDPOINTS);
    expect(names).toHaveLength(11);
    for (const name of names) {
      expect(typeof (serverFunctions as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('RES-86 sends each function to the method and path the table declares', async () => {
    const e = RESUME_ENDPOINTS;
    const sent = [
      (await call((c) => loadResume(c), () => HttpResponse.json(resume))).received[0],
      (await call((c) => loadResumeSummary(c), () => HttpResponse.json({ ready: false }))).received[0],
      (await call((c) => putProfile({ ...profile, locale: 'pt-BR' }, c), () => HttpResponse.json(profile))).received[0],
      (await call((c) => postResumeItem('experiences', { role: 'A', company: 'B', startDate: '2023-03' }, c), () => HttpResponse.json(experience, { status: 201 }))).received[0],
      (await call((c) => patchResumeItem('experiences', itemId, { company: 'C' }, c), () => HttpResponse.json(experience))).received[0],
      (await call((c) => removeResumeItem('experiences', itemId, c), noContent)).received[0],
      (await call((c) => putItemsOrder('experiences', [itemId], c), () => HttpResponse.json({ ids: [itemId] }))).received[0],
      (await call((c) => postBullet('experiences', itemId, { text: 'x', skillIds: [] }, c), () => HttpResponse.json(bulletResponse, { status: 201 }))).received[0],
      (await call((c) => patchBullet('experiences', itemId, bulletId, { text: 'y' }, c), () => HttpResponse.json(bulletResponse))).received[0],
      (await call((c) => removeBullet('experiences', itemId, bulletId, c), noContent)).received[0],
      (await call((c) => putBulletsOrder('experiences', itemId, [bulletId], c), () => HttpResponse.json({ ids: [bulletId] }))).received[0],
    ].map((r) => `${r?.method} ${r?.path}`);

    const fill = (path: string) =>
      path.replace(':section', 'experiences').replace(':id', itemId).replace(':bulletId', bulletId);
    expect(sent).toEqual(
      [
        e.getResume,
        e.getResumeSummary,
        e.saveProfile,
        e.createResumeItem,
        e.updateResumeItem,
        e.deleteResumeItem,
        e.orderResumeItems,
        e.createBullet,
        e.updateBullet,
        e.deleteBullet,
        e.orderBullets,
      ].map((endpoint) => `${endpoint.method} ${fill(endpoint.path)}`),
    );
  });
});

describe('resume server functions', () => {
  it('RES-40 getResume reads the whole resume and parses it with the contract', async () => {
    const { result, received } = await call((c) => loadResume(c), () => HttpResponse.json(resume));

    expect(received).toEqual([{ method: 'GET', path: '/resume', body: undefined }]);
    expect(result).toEqual({ ok: true, data: resume });
  });

  it('RES-86 getResumeSummary reads only { ready }', async () => {
    const { result, received } = await call((c) => loadResumeSummary(c), () => HttpResponse.json({ ready: true }));

    expect(received).toEqual([{ method: 'GET', path: '/resume/summary', body: undefined }]);
    expect(result).toEqual({ ok: true, data: { ready: true } });
  });

  it('RES-44 saveProfile puts the whole profile and parses the saved one', async () => {
    const saved = { ...profile, fullName: 'Pessoa Fictícia Beta' };
    const { result, received } = await call((c) => putProfile(saved as never, c), () => HttpResponse.json(saved));

    expect(received).toEqual([{ method: 'PUT', path: '/resume/profile', body: saved }]);
    expect(result).toEqual({ ok: true, data: saved });
  });

  it.each([
    ['experiences', { role: 'Cargo Fictício', company: 'Empresa Fictícia Alfa', startDate: '2023-03' }, experience],
    ['projects', { name: 'Projeto Fictício' }, project],
    ['educations', { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2019-02', endDate: '2022-12' }, education],
    ['certifications', { name: 'Certificação Fictícia', issuedOn: '2024-05' }, certification],
    ['languages', { language: 'Inglês', level: 'advanced' }, language],
  ] as const)('RES-53 createResumeItem posts a %s body to its section and parses the 201 item', async (section, body, item) => {
    const { result, received } = await call(
      (c) => postResumeItem(section, body as never, c),
      () => HttpResponse.json(item, { status: 201 }),
    );

    expect(received).toEqual([{ method: 'POST', path: `/resume/${section}`, body }]);
    expect(result).toEqual({ ok: true, data: item });
  });

  it('RES-54 updateResumeItem patches only the body it was given, null included', async () => {
    const body = { location: null, endDate: '2024-01' };
    const { result, received } = await call((c) => patchResumeItem('experiences', itemId, body, c), () => HttpResponse.json(experience));

    expect(received).toEqual([{ method: 'PATCH', path: `/resume/experiences/${itemId}`, body }]);
    expect(result).toEqual({ ok: true, data: experience });
  });

  it('RES-58 deleteResumeItem deletes and accepts the 204', async () => {
    const { result, received } = await call((c) => removeResumeItem('languages', itemId, c), noContent);

    expect(received).toEqual([{ method: 'DELETE', path: `/resume/languages/${itemId}`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('RES-70 orderResumeItems puts { ids } and parses { ids }', async () => {
    const ids = [otherItemId, itemId];
    const { result, received } = await call((c) => putItemsOrder('projects', ids, c), () => HttpResponse.json({ ids }));

    expect(received).toEqual([{ method: 'PUT', path: '/resume/projects/order', body: { ids } }]);
    expect(result).toEqual({ ok: true, data: { ids } });
  });

  it('RES-62 createBullet posts text and skillIds and parses the 201 { bullet, skills }', async () => {
    const body = { text: 'Texto fictício de bullet.', skillIds: [skillId] };
    const { result, received } = await call((c) => postBullet('projects', itemId, body, c), () => HttpResponse.json(bulletResponse, { status: 201 }));

    expect(received).toEqual([{ method: 'POST', path: `/resume/projects/${itemId}/bullets`, body }]);
    expect(result).toEqual({ ok: true, data: bulletResponse });
  });

  it('RES-67 updateBullet patches the skills alone and parses { bullet, skills }', async () => {
    const body = { skillIds: [] };
    const { result, received } = await call((c) => patchBullet('experiences', itemId, bulletId, body, c), () => HttpResponse.json(bulletResponse));

    expect(received).toEqual([{ method: 'PATCH', path: `/resume/experiences/${itemId}/bullets/${bulletId}`, body }]);
    expect(result).toEqual({ ok: true, data: bulletResponse });
  });

  it('RES-68 deleteBullet deletes the bullet and accepts the 204', async () => {
    const { result, received } = await call((c) => removeBullet('experiences', itemId, bulletId, c), noContent);

    expect(received).toEqual([{ method: 'DELETE', path: `/resume/experiences/${itemId}/bullets/${bulletId}`, body: undefined }]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('RES-71 orderBullets puts { ids } to the bullets of the item', async () => {
    const ids = [bulletId];
    const { result, received } = await call((c) => putBulletsOrder('experiences', itemId, ids, c), () => HttpResponse.json({ ids }));

    expect(received).toEqual([{ method: 'PUT', path: `/resume/experiences/${itemId}/bullets/order`, body: { ids } }]);
    expect(result).toEqual({ ok: true, data: { ids } });
  });

  it('RES-40 escapes the ids it puts in the path', async () => {
    const { received } = await call((c) => removeResumeItem('experiences', 'a/b?c', c), noContent);

    expect(received[0]?.path).toBe('/resume/experiences/a%2Fb%3Fc');
  });

  it('RES-40 turns a 2xx outside the contract into 503 on every function that reads a body', async () => {
    const wrong = (status = 200) => () => HttpResponse.json({ unexpected: true }, { status });
    const outcomes = await Promise.all([
      call((c) => loadResume(c), wrong()),
      call((c) => loadResumeSummary(c), wrong()),
      call((c) => putProfile({ ...profile, locale: 'pt-BR' } as never, c), wrong()),
      call((c) => postResumeItem('experiences', {} as never, c), wrong(201)),
      call((c) => patchResumeItem('languages', itemId, {}, c), wrong()),
      call((c) => putItemsOrder('experiences', [], c), wrong()),
      call((c) => postBullet('experiences', itemId, { text: 'x', skillIds: [] }, c), wrong(201)),
      call((c) => patchBullet('experiences', itemId, bulletId, { text: 'x' }, c), wrong()),
      call((c) => putBulletsOrder('experiences', itemId, [], c), wrong()),
    ]);

    expect(outcomes.map((o) => o.result)).toEqual(Array.from({ length: 9 }, () => ({ ok: false, status: 503 })));
  });

  it.each([
    [401, 'Unauthorized'],
    [404, 'Not Found'],
    [422, 'Unprocessable Entity'],
    [400, 'Bad Request'],
  ])('RES-40 keeps the problem of a %i so the screen can decide what to show', async (status, title) => {
    const body = problem(status, title);
    const reading = await call((c) => loadResume(c), () => HttpResponse.json(body, { status }));
    const writing = await call((c) => patchBullet('experiences', itemId, bulletId, { text: 'x' }, c), () => HttpResponse.json(body, { status }));
    const ordering = await call((c) => putItemsOrder('experiences', [itemId], c), () => HttpResponse.json(body, { status }));
    const removing = await call((c) => removeResumeItem('experiences', itemId, c), () => HttpResponse.json(body, { status }));

    for (const { result } of [reading, writing, ordering, removing]) {
      expect(result).toEqual({ ok: false, status, problem: body });
    }
  });

  it('RES-40 answers 503 when the api does not answer', async () => {
    const reading = await call((c) => loadResume(c), () => HttpResponse.error());
    const removing = await call((c) => removeBullet('experiences', itemId, bulletId, c), () => HttpResponse.error());

    expect(reading.result).toEqual({ ok: false, status: 503 });
    expect(removing.result).toEqual({ ok: false, status: 503 });
  });
});
