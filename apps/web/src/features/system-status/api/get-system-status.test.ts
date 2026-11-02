import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../../../lib/logger';
import { loadSystemStatus } from './get-system-status';

const apiInternalUrl = 'http://api.test';
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

  const status = await loadSystemStatus({ incomingRequestId, apiInternalUrl, logger });
  const logged = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { status, logged, sent };
}

describe('getSystemStatus', () => {
  it('logs the same requestId it sends to the api in x-request-id', async () => {
    const { status, logged, sent } = await load(undefined);

    expect(status).toEqual({ api: 'operational', database: 'operational' });
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
      loadSystemStatus({ incomingRequestId: undefined, apiInternalUrl, logger }),
    ).resolves.toEqual({ api: 'unavailable', database: 'unavailable' });
  });
});
