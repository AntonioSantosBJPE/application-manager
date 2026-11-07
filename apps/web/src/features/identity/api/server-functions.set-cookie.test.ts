import { AsyncLocalStorage } from 'node:async_hooks';
import { getResponseHeaders } from '@tanstack/react-start/server';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the Start compiler keeps in a production build: the handler is extracted and the exported
 * function becomes a remote stub. A unit test reaches the handler by standing in for that compiler,
 * which is this mock and nothing else. The response layer below is the real one.
 */
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-start')>()),
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: (ctx: { data: unknown }) => Promise<unknown>) => handler,
    };
    return builder;
  },
}));

const apiInternalUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  process.env.API_INTERNAL_URL = apiInternalUrl;
  process.env.WEB_PUBLIC_URL = 'https://app.example.test';
  delete process.env.CLIENT_IP_HEADER;
});

// Both storages the real server runtime fills for a request: the start context the server function
// helpers read, and the event the response helpers write to. Their keys are the ones Start uses.
function storageFor(name: string): AsyncLocalStorage<unknown> {
  const key = Symbol.for(name);
  const global = globalThis as Record<symbol, unknown>;
  global[key] ??= new AsyncLocalStorage();
  return global[key] as AsyncLocalStorage<unknown>;
}

const startStorage = storageFor('tanstack-start:start-storage-context');
const eventStorage = storageFor('tanstack-start:event-storage');

type Handler = (ctx: { data: unknown }) => Promise<unknown>;

/** Runs one server function as the server runtime would, and returns the Set-Cookie headers it answered. */
async function runInRequest(run: Handler, data: unknown): Promise<{ result: unknown; setCookie: string[] }> {
  const request = Object.assign(
    new Request('http://web-internal:3000/_serverFn/server-function', {
      headers: { cookie: 'am_session=token-abc' },
    }),
    // srvx puts the connection address here; `getRequestIP()` reads it without trusting a header.
    { context: { clientAddress: '203.0.113.7' } },
  );
  const startContext = {
    request,
    startOptions: {},
    contextAfterGlobalMiddlewares: {},
    getRouter: () => ({}),
    handlerType: 'serverFn',
  };
  const event = { request, requestUrl: new URL(request.url) };

  return startStorage.run(startContext, () =>
    eventStorage.run(event, async () => ({
      result: await run({ data }),
      setCookie: getResponseHeaders().getSetCookie(),
    })),
  );
}

const user = { id: '8f6a1c2e-0000-7000-8000-000000000001', email: 'someone@example.test', name: 'Someone', role: 'member' };
const created = { inviteUrl: 'https://app.example.test/invite/token-1', expiresAt: '2026-11-13T00:00:00.000Z' };
const invitation = { email: 'someone@example.test', expiresAt: '2026-11-13T00:00:00.000Z' };
const page = { items: [], nextCursor: null, totalPending: 0 };

/** A `2xx` body each function accepts, so the cookie is what the assertion is about. */
function bodyFor(name: string): unknown {
  if (name === 'getSession') return user;
  if (name === 'invite') return created;
  if (name === 'openInvitation') return invitation;
  if (name === 'pendingInvitations') return page;
  return undefined;
}

/** Answers the api once with that body and those cookies. */
function answerApi(body: unknown, cookies: string[], status = 200): void {
  server.use(
    http.all(`${apiInternalUrl}/*`, () => {
      const response =
        body === undefined
          ? new HttpResponse(null, { status })
          : HttpResponse.json(body as Record<string, unknown>, { status });
      for (const cookie of cookies) response.headers.append('set-cookie', cookie);
      return response;
    }),
  );
}

/** Every server function that forwards an api answer, with the input it needs. */
async function serverFunctions(): Promise<Array<{ name: string; run: Handler; data: unknown }>> {
  const functions = await import('./server-functions');
  return [
    { name: 'getSession', run: functions.getSession as unknown as Handler, data: undefined },
    {
      name: 'memberLogin',
      run: functions.memberLogin as unknown as Handler,
      data: { email: 'someone@example.test', password: 'a-long-password' },
    },
    {
      name: 'adminLogin',
      run: functions.adminLogin as unknown as Handler,
      data: { email: 'admin@example.test', password: 'a-long-password' },
    },
    { name: 'endSession', run: functions.endSession as unknown as Handler, data: undefined },
    { name: 'invite', run: functions.invite as unknown as Handler, data: { email: 'someone@example.test' } },
    { name: 'openInvitation', run: functions.openInvitation as unknown as Handler, data: 'token-1' },
    {
      name: 'joinWithInvitation',
      run: functions.joinWithInvitation as unknown as Handler,
      data: { token: 'token-1', name: 'Someone', password: 'a-long-password' },
    },
    { name: 'pendingInvitations', run: functions.pendingInvitations as unknown as Handler, data: undefined },
    {
      name: 'revoke',
      run: functions.revoke as unknown as Handler,
      data: '8f6a1c2e-0000-7000-8000-000000000002',
    },
  ];
}

describe('identity server functions and the Set-Cookie of the api', () => {
  const cases: Array<[string, string[], number]> = [
    ['one cookie', ['am_session=fresh; Path=/; HttpOnly'], 1],
    ['two cookies', ['am_session=fresh; Path=/; HttpOnly', 'am_theme=dark; Path=/'], 2],
  ];

  for (const [label, cookies, expected] of cases) {
    it(`appends ${label} to the answer the browser receives`, async () => {
      for (const { name, run, data } of await serverFunctions()) {
        answerApi(bodyFor(name), cookies);

        const { setCookie } = await runInRequest(run, data);

        // One header per cookie, in the order the api sent them; never one merged value.
        expect(setCookie, name).toEqual(cookies);
        expect(setCookie, name).toHaveLength(expected);
      }
    });
  }

  it('appends the cookie of a refused answer too, because a rejected session is cleared there', async () => {
    const clearing = 'am_session=; Path=/; Max-Age=0';
    for (const { name, run, data } of await serverFunctions()) {
      answerApi({ type: 'about:blank', title: 'Unauthorized', status: 401 }, [clearing], 401);

      const { setCookie } = await runInRequest(run, data);

      expect(setCookie, name).toEqual([clearing]);
    }
  });

  it('answers no cookie when the api sends none', async () => {
    for (const { name, run, data } of await serverFunctions()) {
      answerApi(bodyFor(name), []);

      const { setCookie } = await runInRequest(run, data);

      expect(setCookie, name).toEqual([]);
    }
  });
});

describe('contextOfCurrentRequest', () => {
  it('forwards the browser cookie and the address the request arrived from', async () => {
    const { contextOfCurrentRequest } = await import('./server-functions');

    const context = await runInRequest(async () => contextOfCurrentRequest(), undefined);

    expect(context.result).toMatchObject({
      apiInternalUrl,
      cookie: 'am_session=token-abc',
      clientIp: '203.0.113.7',
    });
  });
});
