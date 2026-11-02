import { expect, test } from '@playwright/test';
import { compose, composeOk, inspectService, projectName } from '../../support/compose.js';
import { run } from '../../support/docker.js';

test.describe('failures', () => {
  test('a failing migration exits non-zero and api never starts', () => {
    // SKEL-09. A project of its own (no published ports, its own volume) so the main stack is untouched.
    test.setTimeout(5 * 60_000);
    const broken = `${projectName}-broken`;
    const args = (...rest: string[]) => ['--project-name', broken, '--file', 'compose.yaml', '--file', 'tests/e2e/fixtures/broken-migrations.compose.yaml', ...rest];

    try {
      const up = compose(args('up', '--detach'));
      expect(up.status, 'compose up fails when a dependency fails').not.toBe(0);

      const migrate = inspectService('migrate', broken);
      expect(migrate.State.Status).toBe('exited');
      expect(migrate.State.ExitCode).not.toBe(0);
      expect(composeOk(args('logs', 'migrate'))).toContain('Migration failed');

      // The api container was never started: it does not exist, or it was created and left unstarted.
      const apiContainers = run('docker', [
        'ps', '--all', '--quiet',
        '--filter', `label=com.docker.compose.project=${broken}`,
        '--filter', 'label=com.docker.compose.service=api',
      ]).output.trim();
      if (apiContainers) {
        const api = inspectService('api', broken);
        expect(api.State.Status).toBe('created');
        expect(api.State.StartedAt.startsWith('0001-01-01')).toBe(true);
      }
    } finally {
      compose(args('down', '--volumes', '--remove-orphans'));
    }
  });

  test('web and api exit non-zero naming the missing variable', () => {
    // SKEL-11. `run` starts one-off containers with no published ports; --no-deps keeps them away from the database.
    const cases = [
      { service: 'api', variable: 'DATABASE_URL' },
      { service: 'migrate', variable: 'DATABASE_URL' },
      { service: 'web', variable: 'API_INTERNAL_URL' },
    ];
    for (const { service, variable } of cases) {
      const result = compose(['run', '--rm', '--no-deps', '--env', `${variable}=`, service]);
      expect(result.status, `${service} without ${variable}`).not.toBe(0);
      expect(result.output, `${service} names the variable`).toContain(`Missing required environment variable: ${variable}`);
    }
  });
});
