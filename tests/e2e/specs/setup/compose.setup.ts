import { expect, test } from '@playwright/test';
import { compose, composeOk, inspectService, projectName } from '../../support/compose.js';
import { run } from '../../support/docker.js';

// SKEL-01: the stack starts from the production images with one command and the page answers in time.
const startupBudgetMs = 120_000;

test.describe('compose', () => {
  test('starts web, api, migrate and postgres and answers 200 within 120 seconds', async ({ request }) => {
    test.setTimeout(20 * 60_000);

    // A stale volume would make "first start" meaningless for the migration tests that follow.
    composeOk(['down', '--volumes', '--remove-orphans']);
    // The budget covers what `docker compose up` does on a fresh clone, the image build included: the
    // images of this project are removed first (the BuildKit cache stays, as it would on a developer machine).
    const projectImages = [`${projectName}-api`, `${projectName}-web`];
    run('docker', ['image', 'rm', '--force', ...projectImages]);
    for (const image of projectImages) {
      expect(run('docker', ['image', 'inspect', image]).status, `${image} was removed before the timed up`).not.toBe(0);
    }

    const startedAt = Date.now();
    composeOk(['up', '--detach', '--build', '--wait']);
    await expect
      .poll(async () => (await request.get('/status')).status(), { timeout: startupBudgetMs - (Date.now() - startedAt) })
      .toBe(200);
    const elapsedMs = Date.now() - startedAt;
    console.log(`compose up --build: page answered 200 after ${(elapsedMs / 1000).toFixed(1)} s`);
    expect(elapsedMs).toBeLessThan(startupBudgetMs);

    for (const service of ['web', 'api', 'postgres']) {
      expect(inspectService(service).State.Running, `${service} is running`).toBe(true);
    }
    const migrate = inspectService('migrate').State;
    expect(migrate.Status).toBe('exited');
    expect(migrate.ExitCode).toBe(0);
    expect(compose(['config', '--services']).output.split('\n').filter(Boolean).sort()).toEqual(['api', 'migrate', 'postgres', 'web']);
  });
});
