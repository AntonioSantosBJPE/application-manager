import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../../../lib/logger';
import { loadSystemStatus } from './get-system-status';

const apiInternalUrl = 'http://api.test';
const readAt = new Date('2026-11-08T17:32:07.000Z');
const now = () => readAt;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Runs one SSR status load and returns what the web logged and what it sent to the API. */
async function load(incomingRequestId: string | undefined) {
  const lines: string[] = [];
  const logger = createLogger({ level: 'info', destination: { write: (line) => lines.push(line) } });
  const sent: (string | null)[] = [];
  server.use(
    http.get(`${apiInternalUrl}/health`, ({ request }) => {
      sent.push(request.headers.get('x-request-id'));
      return HttpResponse.json({ status: 'ok', db: 'up' });
    }),
  );

  const status = await loadSystemStatus({ incomingRequestId, apiInternalUrl, logger, now });
  const logged = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { status, logged, sent };
}

describe('getSystemStatus', () => {
  it('logs the same requestId it sends to the api in x-request-id', async () => {
    const { status, logged, sent } = await load(undefined);

    expect(status).toEqual({
      api: 'operational',
      database: 'operational',
      checkedAt: '2026-11-08T17:32:07.000Z',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(logged).toContainEqual(
      expect.objectContaining({ level: 'info', requestId: sent[0], msg: expect.any(String) }),
    );
    expect(typeof logged[0]?.time).toBe('string');
  });

  it('reuses a well-formed x-request-id from the incoming request', async () => {
    const { logged, sent } = await load('visit-7f3a.b_c');

    expect(sent).toEqual(['visit-7f3a.b_c']);
    expect(logged).toContainEqual(expect.objectContaining({ requestId: 'visit-7f3a.b_c' }));
  });

  it('replaces a malformed incoming x-request-id with a new id', async () => {
    const malformed = 'bad id with spaces';
    const { logged, sent } = await load(malformed);

    expect(sent[0]).not.toBe(malformed);
    expect(sent[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(logged).toContainEqual(expect.objectContaining({ requestId: sent[0] }));
  });

  it('resolves to both unavailable instead of throwing when the api fails', async () => {
    const logger = createLogger({ level: 'info', destination: { write: () => undefined } });
    server.use(http.get(`${apiInternalUrl}/health`, () => HttpResponse.error()));

    await expect(
      loadSystemStatus({ incomingRequestId: undefined, apiInternalUrl, logger, now }),
    ).resolves.toEqual({
      api: 'unavailable',
      database: 'unavailable',
      checkedAt: '2026-11-08T17:32:07.000Z',
    });
  });

  it('PRU-06 AC21 stamps the status with the instant the web read the health, after the answer', async () => {
    const logger = createLogger({ level: 'info', destination: { write: () => undefined } });
    const instants: Date[] = [];
    let answered = false;
    server.use(
      http.get(`${apiInternalUrl}/health`, () => {
        answered = true;
        return HttpResponse.json({ status: 'ok', db: 'up' });
      }),
    );

    const status = await loadSystemStatus({
      incomingRequestId: undefined,
      apiInternalUrl,
      logger,
      now: () => {
        expect(answered).toBe(true);
        const instant = new Date(Date.UTC(2026, 10, 8, 17, 32, 7 + instants.length));
        instants.push(instant);
        return instant;
      },
    });

    expect(instants).toHaveLength(1);
    expect(status.checkedAt).toBe('2026-11-08T17:32:07.000Z');
  });

  it('stamps the real clock when no clock is given', async () => {
    const logger = createLogger({ level: 'info', destination: { write: () => undefined } });
    server.use(
      http.get(`${apiInternalUrl}/health`, () => HttpResponse.json({ status: 'ok', db: 'up' })),
    );
    const before = Date.now();

    const { checkedAt } = await loadSystemStatus({
      incomingRequestId: undefined,
      apiInternalUrl,
      logger,
    });

    expect(Date.parse(checkedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(checkedAt)).toBeLessThanOrEqual(Date.now());
    expect(checkedAt).toBe(new Date(checkedAt).toISOString());
  });
});
