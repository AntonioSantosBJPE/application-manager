import { expect, test, type APIRequestContext } from '@playwright/test';
import { composeOk, waitHealthy } from '../../support/compose.js';
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
});
