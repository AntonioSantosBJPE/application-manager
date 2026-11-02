import { healthResponseSchema } from '@am/contracts';
import { describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../test/api.js';
import { dockerContainer, startPostgres } from '../../../test/postgres.js';

async function getHealth(baseUrl: string) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.text();
  return { status: response.status, body, elapsedMs: performance.now() - started };
}

describe('GET /health', () => {
  it('returns 200 ok/up when the database answers', async () => {
    const api = await startApi(inject('databaseUrl'));
    try {
      const { status, body } = await getHealth(api.baseUrl);

      expect(status).toBe(200);
      expect(body).toBe('{"status":"ok","db":"up"}');
      expect(healthResponseSchema.safeParse(JSON.parse(body)).success).toBe(true);
    } finally {
      await api.close();
    }
  });

  it('returns 503 degraded/down within 2 seconds when the database does not answer', async () => {
    // A container of its own, paused: it accepts nothing and answers nothing.
    const container = await startPostgres();
    const docker = await dockerContainer(container.getId());
    const api = await startApi(container.getConnectionUri());
    try {
      expect((await getHealth(api.baseUrl)).status).toBe(200);

      await docker.pause();
      const { status, body, elapsedMs } = await getHealth(api.baseUrl);

      expect(status).toBe(503);
      expect(body).toBe('{"status":"degraded","db":"down"}');
      expect(healthResponseSchema.safeParse(JSON.parse(body)).success).toBe(true);
      expect(elapsedMs).toBeLessThanOrEqual(2500);
    } finally {
      if ((await docker.inspect()).State.Paused) await docker.unpause();
      await api.close();
      await container.stop();
    }
  });

  it('returns 503 degraded/down when the database container is stopped', async () => {
    const container = await startPostgres();
    const api = await startApi(container.getConnectionUri());
    try {
      expect((await getHealth(api.baseUrl)).status).toBe(200);

      await container.stop();
      const { status, body, elapsedMs } = await getHealth(api.baseUrl);

      expect(status).toBe(503);
      expect(body).toBe('{"status":"degraded","db":"down"}');
      expect(elapsedMs).toBeLessThanOrEqual(2500);
    } finally {
      await api.close();
    }
  });
});
