import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, inject, it } from 'vitest';
import { dockerContainer, startPostgres } from '../../../test/postgres.js';
import { createPool } from '../../infra/database/pool.js';
import { DatabaseProbe } from './database-probe.js';

function probeFor(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  return { probe: new DatabaseProbe(drizzle(pool)), pool };
}

async function timed<T>(work: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const started = performance.now();
  const result = await work();
  return { result, elapsedMs: performance.now() - started };
}

describe('DatabaseProbe', () => {
  it('returns up when the database answers', async () => {
    const { probe, pool } = probeFor(inject('databaseUrl'));
    try {
      expect(await probe.check()).toBe('up');
    } finally {
      await pool.end();
    }
  });

  it('returns down within 2.5 seconds when the database container is paused', async () => {
    // A container of its own, so pausing it never disturbs the other tests.
    const container = await startPostgres();
    const docker = await dockerContainer(container.getId());
    const { probe, pool } = probeFor(container.getConnectionUri());
    try {
      expect(await probe.check()).toBe('up');

      await docker.pause();
      const { result, elapsedMs } = await timed(() => probe.check());

      expect(result).toBe('down');
      expect(elapsedMs).toBeGreaterThanOrEqual(1950);
      expect(elapsedMs).toBeLessThanOrEqual(2500);

      await docker.unpause();
      await expect.poll(() => probe.check(), { timeout: 10_000, interval: 250 }).toBe('up');
    } finally {
      if ((await docker.inspect()).State.Paused) await docker.unpause();
      await pool.end();
      await container.stop();
    }
  });

  it('returns down when the database container is stopped', async () => {
    const container = await startPostgres();
    const { probe, pool } = probeFor(container.getConnectionUri());
    try {
      expect(await probe.check()).toBe('up');

      await container.stop();
      const { result, elapsedMs } = await timed(() => probe.check());

      expect(result).toBe('down');
      expect(elapsedMs).toBeLessThanOrEqual(2500);
    } finally {
      await pool.end();
    }
  });
});
