import { readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { compose, composeOk, inspectService, projectName, psql, repoRoot } from '../../support/compose.js';

// The specs run in order against the stack that the setup project started (workers: 1).
test.describe('compose', () => {
  test('runs postgres 18', () => {
    // SKEL-02: server_version_num is 180000 for 18.0 and above; the migration also enforces it.
    const versionNum = Number(psql('show server_version_num'));
    expect(versionNum).toBeGreaterThanOrEqual(180000);
    expect(versionNum).toBeLessThan(190000);
    expect(psql('select version()')).toMatch(/^PostgreSQL 18\./);
  });

  test('migrate exits 0 before api starts', () => {
    // SKEL-08: migrate finished successfully, and only then did the api container start.
    const migrate = inspectService('migrate').State;
    const api = inspectService('api').State;
    expect(migrate.Status).toBe('exited');
    expect(migrate.ExitCode).toBe(0);
    expect(new Date(migrate.FinishedAt).getTime()).toBeLessThanOrEqual(new Date(api.StartedAt).getTime());
    const migrationFiles = readdirSync(join(repoRoot, 'apps/api/drizzle')).filter((file) => file.endsWith('.sql'));
    expect(Number(psql('select count(*) from drizzle.__drizzle_migrations'))).toBe(migrationFiles.length);
  });

  test('second compose up applies no migration', () => {
    // SKEL-10: the second `up` runs migrate again, it exits 0 and the migration journal does not change.
    const snapshot = () => psql("select count(*) || '|' || coalesce(string_agg(hash || ':' || created_at, ',' order by created_at), '') from drizzle.__drizzle_migrations");
    const before = snapshot();
    const firstStart = inspectService('migrate').State.StartedAt;
    expect(Number(before.split('|')[0])).toBeGreaterThan(0);

    composeOk(['up', '--detach', '--wait']);

    const migrate = inspectService('migrate').State;
    expect(migrate.StartedAt, 'migrate ran again').not.toBe(firstStart);
    expect(migrate.ExitCode).toBe(0);
    expect(snapshot()).toBe(before);
  });

  test('publishes ports from WEB_PORT, API_PORT and POSTGRES_PORT', ({ baseURL }) => {
    const webPort = process.env.WEB_PORT ?? '3000';
    const apiPort = process.env.API_PORT ?? '3333';
    const postgresPort = process.env.POSTGRES_PORT ?? '5432';

    // The running stack publishes the configured ports; the api and the database only on the loopback
    // interface, so nothing outside this machine reaches the api and the address it counts (AD-004).
    expect(composeOk(['port', 'web', '3000']).trim()).toMatch(new RegExp(`:${webPort}$`));
    expect(composeOk(['port', 'api', '3333']).trim()).toBe(`127.0.0.1:${apiPort}`);
    expect(composeOk(['port', 'postgres', '5432']).trim()).toBe(`127.0.0.1:${postgresPort}`);
    // SKEL-13: Playwright targets the published web port.
    expect(baseURL).toBe(`http://localhost:${webPort}`);

    // Without the variables the model falls back to 3000, 3333 and 5432.
    const empty = join(mkdtempSync(join(tmpdir(), 'am-e2e-env-')), 'empty.env');
    writeFileSync(empty, '');
    const env: NodeJS.ProcessEnv = { ...process.env, POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p', POSTGRES_DB: 'd' };
    for (const key of ['WEB_PORT', 'API_PORT', 'POSTGRES_PORT', 'COMPOSE_PROJECT_NAME']) delete env[key];
    const model = compose(['--env-file', empty, 'config', '--format', 'json'], env);
    expect(model.status, model.output).toBe(0);
    const services = (JSON.parse(model.output) as { services: Record<string, { ports?: { host_ip?: string; published: string; target: number }[] }> }).services;
    expect(services.web?.ports).toEqual([expect.objectContaining({ published: '3000', target: 3000 })]);
    expect(services.api?.ports).toEqual([expect.objectContaining({ host_ip: '127.0.0.1', published: '3333', target: 3333 })]);
    expect(services.postgres?.ports).toEqual([expect.objectContaining({ host_ip: '127.0.0.1', published: '5432', target: 5432 })]);
  });

  test('e2e runs against the compose project of this checkout', async ({ request }) => {
    // GUARD-05: the web answering at baseURL is the container of this checkout's compose project.
    const web = inspectService('web');
    expect(web.Config.Labels['com.docker.compose.project']).toBe(projectName);
    expect(web.Config.Labels['com.docker.compose.project.working_dir']).toBe(repoRoot);

    const requestId = `e2e-project-${Date.now()}`;
    const response = await request.get('/status', { headers: { 'x-request-id': requestId } });
    expect(response.status()).toBe(200);
    expect(composeOk(['logs', 'web']), 'the visit reached this project\'s web container').toContain(requestId);
  });
});
