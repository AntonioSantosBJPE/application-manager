import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { toSystemStatus } from '../model/system-status';
import { fetchHealth } from './fetch-health';

const apiUrl = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const bothUnavailable = { api: 'unavailable', database: 'unavailable' };

async function statusWith(response: () => Response | Promise<Response>) {
  server.use(http.get(`${apiUrl}/health`, response));
  return toSystemStatus(await fetchHealth(apiUrl, 'req-1'));
}

describe('system status from GET /health', () => {
  it('200 ok/up: API and database operational', async () => {
    const status = await statusWith(() => HttpResponse.json({ status: 'ok', db: 'up' }));
    expect(status).toEqual({ api: 'operational', database: 'operational' });
  });

  it('503 degraded/down: API operational, database unavailable', async () => {
    const status = await statusWith(() =>
      HttpResponse.json({ status: 'degraded', db: 'down' }, { status: 503 }),
    );
    expect(status).toEqual({ api: 'operational', database: 'unavailable' });
  });

  it('an API slower than 3 seconds: both unavailable, after 3 seconds', async () => {
    const started = performance.now();
    const status = await statusWith(async () => {
      await delay(6_000);
      return HttpResponse.json({ status: 'ok', db: 'up' });
    });
    const elapsed = performance.now() - started;

    expect(status).toEqual(bothUnavailable);
    // The default timeout is the 3 seconds of EDGE-02: not earlier, and not waiting for the API.
    expect(elapsed).toBeGreaterThanOrEqual(2_950);
    expect(elapsed).toBeLessThan(4_000);
  }, 10_000);

  it('the 3 second limit: an API answering in 2.5 s is reachable, one answering in 3.1 s is not', async () => {
    async function answeringAfter(ms: number) {
      server.use(
        http.get(`${apiUrl}/health`, async () => {
          await delay(ms);
          return HttpResponse.json({ status: 'ok', db: 'up' });
        }),
      );
      return fetchHealth(apiUrl, 'req-1');
    }

    const inTime = await answeringAfter(2_500);
    expect(inTime).toEqual({ kind: 'reachable', health: { status: 'ok', db: 'up' } });
    expect(toSystemStatus(inTime)).toEqual({ api: 'operational', database: 'operational' });

    const late = await answeringAfter(3_100);
    expect(late).toEqual({ kind: 'unreachable' });
    expect(toSystemStatus(late)).toEqual(bothUnavailable);
  }, 10_000);

  it('a network error: both unavailable', async () => {
    const status = await statusWith(() => HttpResponse.error());
    expect(status).toEqual(bothUnavailable);
  });

  it('a status other than 200 or 503: both unavailable', async () => {
    const status = await statusWith(() =>
      HttpResponse.json({ status: 'ok', db: 'up' }, { status: 500 }),
    );
    expect(status).toEqual(bothUnavailable);
  });

  it('a body outside the contract: both unavailable', async () => {
    for (const body of [() => HttpResponse.json({ status: 'ok' }), () => HttpResponse.text('ok')]) {
      expect(await statusWith(body)).toEqual(bothUnavailable);
    }
  });

  it('sends the request id in x-request-id', async () => {
    let received: string | null = null;
    server.use(
      http.get(`${apiUrl}/health`, ({ request }) => {
        received = request.headers.get('x-request-id');
        return HttpResponse.json({ status: 'ok', db: 'up' });
      }),
    );

    await fetchHealth(apiUrl, 'req-from-web-42');

    expect(received).toBe('req-from-web-42');
  });
});
