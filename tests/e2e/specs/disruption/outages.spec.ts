import { expect, test, type APIRequestContext } from '@playwright/test';
import { compose, composeOk, inspectService, waitHealthy } from '../../support/compose.js';
import { visibleText } from '../../support/html.js';

async function statusPage(request: APIRequestContext): Promise<{ status: number; text: string }> {
  const response = await request.get('/status');
  return { status: response.status(), text: visibleText(await response.text()) };
}

/** Waits until the page shows the healthy stack again, so the next test starts from a known state. */
async function expectRecovered(request: APIRequestContext): Promise<void> {
  await expect
    .poll(async () => (await statusPage(request)).text, { timeout: 60_000 })
    .toMatch(/API Operacional.*Banco de dados Operacional/);
}

// Each test restores what it broke in `finally`, then waits for the healthchecks.
test.describe('outages', () => {
  test('shows both rows Indisponível with 200 when the api is down', async ({ request }) => {
    // SKEL-06: a stopped api turns the page into two "Indisponível" rows, not an error page.
    composeOk(['stop', 'api']);
    try {
      await expect
        .poll(() => statusPage(request))
        .toEqual({ status: 200, text: expect.stringMatching(/API Indisponível.*Banco de dados Indisponível/) });
    } finally {
      composeOk(['start', 'api']);
      await waitHealthy('api');
      await expectRecovered(request);
    }
  });

  test('treats an api slower than 3 seconds as Indisponível', async ({ request }) => {
    // EDGE-02: a paused api accepts the connection and never answers; the web gives up after 3 s.
    composeOk(['pause', 'api']);
    try {
      const startedAt = Date.now();
      const page = await statusPage(request);
      const elapsedMs = Date.now() - startedAt;
      expect(page.status).toBe(200);
      expect(page.text).toMatch(/API Indisponível.*Banco de dados Indisponível/);
      expect(elapsedMs, 'the page waited for the 3 s timeout').toBeGreaterThanOrEqual(2_950);
      expect(elapsedMs).toBeLessThan(5_000);
    } finally {
      composeOk(['unpause', 'api']);
      await waitHealthy('api');
      await expectRecovered(request);
    }
  });

  test('shows API Operacional and Banco de dados Indisponível when the database is down', async ({ request }) => {
    // SKEL-04 seen from the page: the api answers 503 degraded, the web shows only the database as down.
    composeOk(['stop', 'postgres']);
    try {
      await expect
        .poll(() => statusPage(request), { timeout: 30_000 })
        .toEqual({ status: 200, text: expect.stringMatching(/API Operacional.*Banco de dados Indisponível/) });
    } finally {
      composeOk(['start', 'postgres']);
      await waitHealthy('postgres');
      await expectRecovered(request);
    }
  });

  test('shows the unavailable message without redirecting to login when the api is down', async ({ page }) => {
    // UI-05: an api that does not answer during the session check is said on the page the person asked
    // for, with no session and no redirect: sending them to login would blame them for an outage.
    composeOk(['stop', 'api']);
    try {
      await page.goto('/');
      await expect(page.getByText('Serviço indisponível. Tente novamente em instantes.')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/');
      await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0);
    } finally {
      composeOk(['start', 'api']);
      await waitHealthy('api');
    }
  });

  test('web stays healthy through /status when the api is down', async () => {
    // EDGE-06: the healthcheck of the web asks its own page, which answers 200 even with the api down, so
    // an outage of the api never restarts the web. Two facts have to hold, and the health state of the
    // container proves neither on its own: the healthcheck asks `/status`, and its own command still
    // exits 0 with the api stopped. The web was healthy before the outage and a healthcheck only re-runs
    // after its interval, so `web healthy` is true during the outage either way.
    const healthcheck = inspectService('web').Config.Healthcheck;
    expect(healthcheck, 'the web declares a healthcheck').toBeDefined();
    const command = healthcheck!.Test.join(' ');
    // The page it asks is `/status`, not `/`: `/` needs the api, and a healthcheck on it would restart
    // the web on every api outage. The path is read from the command the container actually runs.
    expect(command, 'the healthcheck asks /status').toContain('/status');

    composeOk(['stop', 'api']);
    try {
      // The very command of the healthcheck, run inside the running container: exit 0 means the page it
      // asks answered ok while the api was gone.
      const probe = compose(['exec', '-T', 'web', ...healthcheck!.Test.slice(1)]);
      expect(probe.status, `the healthcheck command failed with the api down:\n${probe.output}`).toBe(0);

      // And the container's own health history agrees: the last run of the outage exited 0, so Docker will
      // not restart the web for it.
      await expect
        .poll(() => inspectService('web').State.Health?.Log.at(-1)?.ExitCode, {
          message: 'the last healthcheck run of the outage exits 0',
          timeout: 30_000,
        })
        .toBe(0);
    } finally {
      composeOk(['start', 'api']);
      await waitHealthy('api');
    }
  });
});
