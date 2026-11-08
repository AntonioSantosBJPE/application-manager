import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiRequestContext } from '../../../lib/call-api';
import { findSkills, postSkill } from './server-functions';

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

const skill = { id: '8f6a1c2e-0000-7000-8000-000000000001', name: 'Skill Fictícia Alfa', category: 'tool', scope: 'global' };
const privateSkill = { ...skill, name: 'Skill Fictícia Beta', category: 'practice', scope: 'private' };

async function call<T>(run: (context: ApiRequestContext) => Promise<T>, respond: () => Response) {
  const received: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.all(`${apiInternalUrl}/*`, async ({ request }) => {
      const text = await request.text();
      const url = new URL(request.url);
      received.push({ method: request.method, path: url.pathname + url.search, body: text === '' ? undefined : (JSON.parse(text) as unknown) });
      return respond();
    }),
  );
  return { result: await run(context), received };
}

describe('member skills server functions', () => {
  it('APP-59 searchSkills sends the text as q and parses the list', async () => {
    const { result, received } = await call((c) => findSkills({ q: 'node js' }, c), () => HttpResponse.json([skill]));

    expect(received).toEqual([{ method: 'GET', path: '/skills?q=node+js', body: undefined }]);
    expect(result).toEqual({ ok: true, data: [skill] });
  });

  it('APP-59 searchSkills sends no query string without a text', async () => {
    const { received } = await call((c) => findSkills({}, c), () => HttpResponse.json([]));

    expect(received[0]?.path).toBe('/skills');
  });

  it('APP-59 searchSkills turns a 2xx outside the contract into 503', async () => {
    const { result } = await call((c) => findSkills({ q: 'a' }, c), () => HttpResponse.json({ unexpected: true }));

    expect(result).toEqual({ ok: false, status: 503 });
  });

  it('APP-60 createSkill posts name and category and parses the 201 private skill', async () => {
    const body = { name: 'Skill Fictícia Beta', category: 'practice' as const };
    const { result, received } = await call((c) => postSkill(body, c), () => HttpResponse.json(privateSkill, { status: 201 }));

    expect(received).toEqual([{ method: 'POST', path: '/skills', body }]);
    expect(result).toEqual({ ok: true, data: privateSkill });
  });

  it('APP-60 createSkill accepts the 200 of a skill the member already had', async () => {
    const { result } = await call(
      (c) => postSkill({ name: 'Skill Fictícia Beta', category: 'practice' }, c),
      () => HttpResponse.json(privateSkill, { status: 200 }),
    );

    expect(result).toEqual({ ok: true, data: privateSkill });
  });

  it('APP-60 createSkill keeps the problem of a refusal', async () => {
    const problem = { type: 'about:blank', title: 'Bad Request', status: 400 };
    const { result } = await call(
      (c) => postSkill({ name: 'Skill Fictícia Beta', category: 'practice' }, c),
      () => HttpResponse.json(problem, { status: 400 }),
    );

    expect(result).toEqual({ ok: false, status: 400, problem });
  });
});
