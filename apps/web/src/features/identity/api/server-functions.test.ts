import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiRequestContext } from '../../../lib/call-api';
import {
  acceptInvitation,
  createInvitation,
  loadInvitation,
  loadInvitations,
  loadSession,
  loginAdmin,
  loginMember,
  logout,
  revokeInvitation,
} from './server-functions';

const apiInternalUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const context: ApiRequestContext = {
  apiInternalUrl,
  requestId: 'req-1',
  cookie: 'am_session=token-abc',
  clientIp: '203.0.113.7',
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
      received.push({
        method: request.method,
        path: new URL(request.url).pathname + new URL(request.url).search,
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      });
      return respond(request);
    }),
  );
  return { result: await run(context), received };
}

const user = { id: '8f6a1c2e-0000-7000-8000-000000000001', email: 'someone@example.test', name: 'Someone', role: 'member' };

describe('identity server functions', () => {
  it('getSession calls GET /auth/me and returns the user', async () => {
    const { result, received } = await call(loadSession, () => HttpResponse.json(user));

    expect(received).toEqual([{ method: 'GET', path: '/auth/me', body: undefined }]);
    expect(result).toEqual({ kind: 'authenticated', user });
  });

  it('getSession reads a 401 as nobody signed in, not as a failure to show', async () => {
    const { result } = await call(loadSession, () =>
      HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401 }),
    );

    expect(result).toEqual({ kind: 'anonymous' });
  });

  it('getSession reads an api that does not answer as unavailable, so no one is sent to login', async () => {
    const network = await call(loadSession, () => HttpResponse.error());
    const serverError = await call(loadSession, () => HttpResponse.text('boom', { status: 500 }));
    const offContract = await call(loadSession, () => HttpResponse.json({ id: 'not-a-uuid' }));

    expect(network.result).toEqual({ kind: 'unavailable' });
    expect(serverError.result).toEqual({ kind: 'unavailable' });
    expect(offContract.result).toEqual({ kind: 'unavailable' });
  });

  it('memberLogin posts the credentials to /auth/login and accepts the 204', async () => {
    const { result, received } = await call(
      (context) => loginMember({ email: 'someone@example.test', password: 'a-long-password' }, context),
      () => new HttpResponse(null, { status: 204 }),
    );

    expect(received).toEqual([
      { method: 'POST', path: '/auth/login', body: { email: 'someone@example.test', password: 'a-long-password' } },
    ]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('adminLogin posts to /auth/admin/login, the other entrance of the same credential', async () => {
    const { received } = await call(
      (context) => loginAdmin({ email: 'admin@example.test', password: 'a-long-password' }, context),
      () => new HttpResponse(null, { status: 204 }),
    );

    expect(received[0]?.path).toBe('/auth/admin/login');
  });

  it('a login answers the problem of a 401 so the screen can keep its own words', async () => {
    const problem = { type: 'about:blank', title: 'Unauthorized', status: 401 };
    const { result } = await call(
      (context) => loginMember({ email: 'someone@example.test', password: 'wrong' }, context),
      () => HttpResponse.json(problem, { status: 401 }),
    );

    expect(result).toEqual({ ok: false, status: 401, problem, retryAfterSeconds: undefined });
  });

  it('a login keeps the retry-after of a 429 for the minutes it shows', async () => {
    const problem = { type: 'about:blank', title: 'Too many login attempts', status: 429 };
    const { result } = await call(
      (context) => loginMember({ email: 'someone@example.test', password: 'wrong' }, context),
      () => HttpResponse.json(problem, { status: 429, headers: { 'retry-after': '95' } }),
    );

    expect(result).toEqual({ ok: false, status: 429, problem, retryAfterSeconds: 95 });
  });

  it('logout posts to /auth/logout and accepts the 204', async () => {
    const { result, received } = await call(logout, () => new HttpResponse(null, { status: 204 }));

    expect(received).toEqual([{ method: 'POST', path: '/auth/logout', body: undefined }]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('createInvitation posts the email and returns the link with its expiry', async () => {
    const created = { inviteUrl: 'http://localhost:3000/invite/token-1', expiresAt: '2026-11-13T00:00:00.000Z' };
    const { result, received } = await call(
      (context) => createInvitation({ email: 'someone@example.test' }, context),
      () => HttpResponse.json(created, { status: 201 }),
    );

    expect(received).toEqual([{ method: 'POST', path: '/invitations', body: { email: 'someone@example.test' } }]);
    expect(result).toEqual({ ok: true, data: created });
  });

  it('createInvitation reads a 409 as the email already having an account (ADM-09)', async () => {
    const problem = { type: 'about:blank', title: 'Email already registered', status: 409 };
    const { result } = await call(
      (context) => createInvitation({ email: 'someone@example.test' }, context),
      () => HttpResponse.json(problem, { status: 409 }),
    );

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it('loadInvitation calls the token endpoint and returns email and expiry', async () => {
    const details = { email: 'someone@example.test', expiresAt: '2026-11-13T00:00:00.000Z' };
    const { result, received } = await call(
      (context) => loadInvitation('tok en/with?chars', context),
      () => HttpResponse.json(details),
    );

    // The token is a path segment, so it is encoded: a `/` or `?` in it must not reach another path.
    expect(received).toEqual([{ method: 'GET', path: '/invitations/tok%20en%2Fwith%3Fchars', body: undefined }]);
    expect(result).toEqual({ ok: true, data: details });
  });

  it('loadInvitation reads an unusable link as 410', async () => {
    const problem = { type: 'about:blank', title: 'Invitation is not usable', status: 410 };
    const { result } = await call(
      (context) => loadInvitation('token-1', context),
      () => HttpResponse.json(problem, { status: 410 }),
    );

    expect(result).toEqual({ ok: false, status: 410, problem, retryAfterSeconds: undefined });
  });

  it('acceptInvitation posts name and password to the token accept endpoint', async () => {
    const { result, received } = await call(
      (context) => acceptInvitation({ name: 'Someone', password: 'a-long-password' }, 'token-1', context),
      () => new HttpResponse(null, { status: 201 }),
    );

    expect(received).toEqual([
      { method: 'POST', path: '/invitations/token-1/accept', body: { name: 'Someone', password: 'a-long-password' } },
    ]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('acceptInvitation reads a 400 as the invalid body the api refused (INV-08)', async () => {
    const problem = { type: 'about:blank', title: 'Invalid body', status: 400, errors: [{ path: 'password', code: 'too_small' }] };
    const { result } = await call(
      (context) => acceptInvitation({ name: 'Someone', password: 'short' }, 'token-1', context),
      () => HttpResponse.json(problem, { status: 400 }),
    );

    expect(result).toEqual({ ok: false, status: 400, problem, retryAfterSeconds: undefined });
  });

  it('loadInvitations asks the first page without a cursor and the next one with it', async () => {
    const page = { items: [], nextCursor: 'cursor-2', totalPending: 0 };
    const first = await call((context) => loadInvitations(undefined, context), () => HttpResponse.json(page));
    const next = await call((context) => loadInvitations('cursor-2', context), () => HttpResponse.json(page));

    expect(first.received).toEqual([{ method: 'GET', path: '/invitations', body: undefined }]);
    expect(next.received).toEqual([{ method: 'GET', path: '/invitations?cursor=cursor-2', body: undefined }]);
    expect(first.result).toEqual({ ok: true, data: page });
  });

  it('revokeInvitation sends a DELETE and accepts the 204', async () => {
    const { result, received } = await call(
      (context) => revokeInvitation('8f6a1c2e-0000-7000-8000-000000000002', context),
      () => new HttpResponse(null, { status: 204 }),
    );

    expect(received).toEqual([
      { method: 'DELETE', path: '/invitations/8f6a1c2e-0000-7000-8000-000000000002', body: undefined },
    ]);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('revokeInvitation reads a 404 as an invitation that is no longer pending', async () => {
    const problem = { type: 'about:blank', title: 'Invitation not found', status: 404 };
    const { result } = await call(
      (context) => revokeInvitation('8f6a1c2e-0000-7000-8000-000000000002', context),
      () => HttpResponse.json(problem, { status: 404 }),
    );

    expect(result).toEqual({ ok: false, status: 404, problem, retryAfterSeconds: undefined });
  });

  it('a 2xx whose body is outside the contract becomes unavailable instead of reaching a screen', async () => {
    const { result } = await call(loadSession, () => HttpResponse.json({ id: user.id, email: user.email }));

    expect(result).toEqual({ kind: 'unavailable' });
  });
});
