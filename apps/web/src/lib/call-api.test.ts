import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiContextOf, callApi, type ApiRequest, type ApiRequestContext } from './call-api';

const apiInternalUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const context: ApiRequestContext = {
  apiInternalUrl,
  requestId: 'req-from-web-1',
  cookie: 'am_session=token-abc',
  clientIp: '203.0.113.7',
};

/** Runs one call and collects what reached the api and which cookies came back. */
async function call(
  request: ApiRequest,
  respond: (incoming: Request) => Response | Promise<Response>,
  options: { timeoutMs?: number } = {},
) {
  const received: Request[] = [];
  const cookies: string[] = [];
  server.use(
    http.all(`${apiInternalUrl}/*`, async ({ request: incoming }) => {
      received.push(incoming);
      return respond(incoming);
    }),
  );
  const result = await callApi(request, context, {
    appendSetCookie: (value) => cookies.push(value),
    ...options,
  });
  return { result, received, cookies };
}

describe('callApi', () => {
  it('forwards method, path, request id, session cookie and client ip', async () => {
    const { result, received } = await call({ method: 'GET', path: '/auth/me' }, () =>
      HttpResponse.json({ id: 'u-1', email: 'someone@example.test', name: 'Someone', role: 'member' }),
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { id: 'u-1', email: 'someone@example.test', name: 'Someone', role: 'member' },
    });
    expect(received).toHaveLength(1);
    const sent = received[0]!;
    expect(sent.method).toBe('GET');
    expect(new URL(sent.url).pathname).toBe('/auth/me');
    expect(sent.headers.get('x-request-id')).toBe('req-from-web-1');
    expect(sent.headers.get('cookie')).toBe('am_session=token-abc');
    expect(sent.headers.get('x-am-client-ip')).toBe('203.0.113.7');
  });

  it('sends the body as JSON with its content type for a post', async () => {
    const { received } = await call(
      { method: 'POST', path: '/auth/login', body: { email: 'someone@example.test', password: 'a-long-password' } },
      () => new HttpResponse(null, { status: 204 }),
    );

    const sent = received[0]!;
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('content-type')).toBe('application/json');
    await expect(sent.json()).resolves.toEqual({
      email: 'someone@example.test',
      password: 'a-long-password',
    });
  });

  it('SKL-54 sends a PATCH with its JSON body, so the edit endpoints are reachable', async () => {
    const { result, received } = await call(
      { method: 'PATCH', path: '/skills/skill-1', body: { name: 'Skill Fictícia Alfa', category: 'tool' } },
      () => HttpResponse.json({ id: 'skill-1' }),
    );

    expect(result).toEqual({ ok: true, status: 200, data: { id: 'skill-1' } });
    expect(received).toHaveLength(1);
    const sent = received[0]!;
    expect(sent.method).toBe('PATCH');
    expect(new URL(sent.url).pathname).toBe('/skills/skill-1');
    expect(sent.headers.get('content-type')).toBe('application/json');
    await expect(sent.json()).resolves.toEqual({ name: 'Skill Fictícia Alfa', category: 'tool' });
  });

  it('answers 204 with no data so a successful login needs no body', async () => {
    const { result } = await call({ method: 'POST', path: '/auth/login' }, () => new HttpResponse(null, { status: 204 }));

    expect(result).toEqual({ ok: true, status: 204, data: undefined });
  });

  it('replays every Set-Cookie of one answer, not only the first', async () => {
    const { cookies } = await call({ method: 'POST', path: '/auth/login' }, () => {
      const response = new HttpResponse(null, { status: 204 });
      response.headers.append('set-cookie', 'am_session=first; Path=/; HttpOnly');
      response.headers.append('set-cookie', 'am_theme=dark; Path=/');
      return response;
    });

    expect(cookies).toEqual(['am_session=first; Path=/; HttpOnly', 'am_theme=dark; Path=/']);
  });

  it('replays the cookie of an error answer too, because a rejected session is cleared there', async () => {
    const { result, cookies } = await call({ method: 'POST', path: '/auth/logout' }, () => {
      const response = HttpResponse.json(
        { type: 'about:blank', title: 'Unauthorized', status: 401 },
        { status: 401 },
      );
      response.headers.append('set-cookie', 'am_session=; Path=/; Max-Age=0');
      return response;
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      problem: { type: 'about:blank', title: 'Unauthorized', status: 401 },
    });
    expect(cookies).toEqual(['am_session=; Path=/; Max-Age=0']);
  });

  it('returns the problem details of an error with its status', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Email already registered',
      status: 409,
      detail: 'The email has an account',
    };
    const { result } = await call({ method: 'POST', path: '/invitations' }, () =>
      HttpResponse.json(problem, { status: 409 }),
    );

    expect(result).toEqual({ ok: false, status: 409, problem });
  });

  it('returns the retry-after seconds of a 429 so the screen can round them up', async () => {
    const problem = { type: 'about:blank', title: 'Too many login attempts', status: 429 };
    const { result } = await call({ method: 'POST', path: '/auth/login' }, () =>
      HttpResponse.json(problem, { status: 429, headers: { 'retry-after': '95' } }),
    );

    expect(result).toEqual({ ok: false, status: 429, problem, retryAfterSeconds: 95 });
  });

  it('omits retryAfterSeconds when the header is absent or is not a number of seconds', async () => {
    const problem = { type: 'about:blank', title: 'Too many login attempts', status: 429 };
    for (const headers of [{}, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }] as Record<string, string>[]) {
      const { result } = await call({ method: 'POST', path: '/auth/login' }, () =>
        HttpResponse.json(problem, { status: 429, headers }),
      );
      expect(result).toEqual({ ok: false, status: 429, problem });
    }
  });

  it('answers 503 for a network failure', async () => {
    const { result } = await call({ method: 'GET', path: '/auth/me' }, () => HttpResponse.error());

    expect(result).toEqual({ ok: false, status: 503 });
  });

  it('answers 503 after the 3 second timeout, not when the api finally answers', async () => {
    const started = performance.now();
    const { result } = await call({ method: 'GET', path: '/auth/me' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      return HttpResponse.json({ id: 'u-1', email: 'x@example.test', name: 'X', role: 'member' });
    });
    const elapsed = performance.now() - started;

    expect(result).toEqual({ ok: false, status: 503 });
    expect(elapsed).toBeGreaterThanOrEqual(2_950);
    expect(elapsed).toBeLessThan(4_000);
  }, 10_000);

  it('answers 503 for an error without a problem details body instead of passing a raw failure up', async () => {
    const { result } = await call({ method: 'GET', path: '/auth/me' }, () =>
      HttpResponse.text('Bad Gateway', { status: 502 }),
    );

    expect(result).toEqual({ ok: false, status: 503 });
  });

  it('keeps a problem details body that has no optional detail or errors', async () => {
    const problem = { type: 'about:blank', title: 'Invitation is not usable', status: 410 };
    const { result } = await call({ method: 'GET', path: '/invitations/token-1' }, () =>
      HttpResponse.json(problem, { status: 410 }),
    );

    expect(result).toEqual({ ok: false, status: 410, problem });
  });
});

describe('apiContextOf', () => {
  function request(headers: Record<string, string>, socketAddress: string | undefined) {
    const lowercased = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    return { header: (name: string) => lowercased.get(name.toLowerCase()), socketAddress };
  }

  it('forwards the browser cookie, a well-formed request id and the socket address', () => {
    const context = apiContextOf(
      apiInternalUrl,
      request({ cookie: 'am_session=token-abc', 'x-request-id': 'visit-7f3a' }, '10.0.0.5'),
      undefined,
    );

    expect(context).toEqual({
      apiInternalUrl,
      requestId: 'visit-7f3a',
      cookie: 'am_session=token-abc',
      clientIp: '10.0.0.5',
    });
  });

  it('generates a request id when the browser sends none or a malformed one', () => {
    for (const headers of [{}, { 'x-request-id': 'bad id with spaces' }] as Record<string, string>[]) {
      const context = apiContextOf(apiInternalUrl, request(headers, '10.0.0.5'), undefined);
      expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('takes the client ip from CLIENT_IP_HEADER and never from X-Forwarded-For', () => {
    const withHeader = apiContextOf(
      apiInternalUrl,
      request({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1' }, '10.0.0.5'),
      'cf-connecting-ip',
    );
    const withoutHeader = apiContextOf(
      apiInternalUrl,
      request({ 'x-forwarded-for': '198.51.100.1' }, '10.0.0.5'),
      undefined,
    );

    expect(withHeader.clientIp).toBe('203.0.113.9');
    expect(withoutHeader.clientIp).toBe('10.0.0.5');
  });

  it('forwards no cookie when the browser sent none', () => {
    expect(apiContextOf(apiInternalUrl, request({}, '10.0.0.5'), undefined).cookie).toBeUndefined();
  });
});
