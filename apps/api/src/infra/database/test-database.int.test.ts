import pg from 'pg';
import { describe, expect, inject, it } from 'vitest';
import { dockerContainer } from '../../../test/postgres.js';

describe('test database', () => {
  it('runs postgresql 18 from testcontainers', async () => {
    const client = new pg.Client({ connectionString: inject('databaseUrl') });
    await client.connect();
    try {
      const { rows } = await client.query<{ server_version_num: string }>('show server_version_num');
      const version = Number(rows[0]?.server_version_num);
      expect(version).toBeGreaterThanOrEqual(180000);
      expect(version).toBeLessThan(190000);
    } finally {
      await client.end();
    }

    const info = await (await dockerContainer(inject('databaseContainerId'))).inspect();
    expect(info.Config.Image).toMatch(/^postgres:18[.-]/);
    expect(info.Config.Labels['org.testcontainers']).toBe('true');
  });
});
