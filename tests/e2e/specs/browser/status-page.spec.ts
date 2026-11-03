import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { composeOk } from '../../support/compose.js';
import { visibleText } from '../../support/html.js';
import { readTokens, type Scheme } from '../../support/tokens.js';

/** Computed form of a CSS color, so a declared token value compares with what the browser resolved. */
function resolveColor(page: Page, value: string): Promise<string> {
  return page.evaluate((color) => {
    const probe = document.createElement('div');
    probe.style.color = color;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, value);
}

/** JSON log lines of a compose service; the srvx request lines are plain text and are skipped. */
function jsonLogs(service: string): Record<string, unknown>[] {
  return composeOk(['logs', '--no-log-prefix', service])
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

test.describe('status page', () => {
  test('server html shows API and Banco de dados with their state', async ({ request }) => {
    // SKEL-05: plain GET, no JavaScript executed, so this is the HTML the server rendered.
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const text = visibleText(await response.text());
    expect(text).toContain('API Operacional');
    expect(text).toContain('Banco de dados Operacional');
  });

  test('follows the system color scheme with dark and light tokens', async ({ page }) => {
    // SKEL-07: the computed colors equal the token values declared for the active scheme.
    const tokens = readTokens();
    expect(tokens.dark.surface).not.toBe(tokens.light.surface);
    for (const scheme of ['dark', 'light'] as const satisfies Scheme[]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      const main = page.getByRole('main');
      await expect(main).toBeVisible();
      const [background, color, badge] = await Promise.all([
        main.evaluate((el) => getComputedStyle(el).backgroundColor),
        main.evaluate((el) => getComputedStyle(el).color),
        page.getByRole('group', { name: 'API' }).getByText('Operacional').evaluate((el) => getComputedStyle(el).color),
      ]);
      expect(background, `${scheme} surface`).toBe(await resolveColor(page, tokens[scheme].surface));
      expect(color, `${scheme} text`).toBe(await resolveColor(page, tokens[scheme].text));
      expect(badge, `${scheme} operational status`).toBe(await resolveColor(page, tokens[scheme]['status-operational']));
    }
  });

  test('has no accessibility violations in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((violation) => `${scheme}: ${violation.id} ${violation.help}`)).toEqual([]);
    }
  });

  test('web and api log the same requestId for one visit', async ({ request }) => {
    const logTimeout = { timeout: 20_000 };
    const webLines = () => jsonLogs('web').filter((line) => line.msg === 'health check requested');
    const apiIds = () => new Set(jsonLogs('api').map((line) => line.requestId));

    // LOG-04 and LOG-02: the id sent by the client is the id the web logs and the id the api logs.
    const sent = `e2e-${randomUUID()}`;
    expect((await request.get('/', { headers: { 'x-request-id': sent } })).status()).toBe(200);
    await expect.poll(() => webLines().filter((line) => line.requestId === sent).length, logTimeout).toBe(1);
    await expect.poll(() => apiIds().has(sent), logTimeout).toBe(true);
    const sentTime = String(webLines().find((line) => line.requestId === sent)?.time);

    // Without a header the web generates an id. The container healthcheck visits the page too, so
    // the visit cannot be singled out: every id the web logs from here on must also be in the api logs.
    expect((await request.get('/')).status()).toBe(200);
    const generatedSince = () => webLines().filter((line) => String(line.time) > sentTime && line.requestId !== sent);
    await expect.poll(() => generatedSince().length, logTimeout).toBeGreaterThan(0);
    expect(generatedSince().every((line) => /^[0-9a-f-]{36}$/.test(String(line.requestId)))).toBe(true);
    await expect
      .poll(() => generatedSince().map((line) => line.requestId).filter((id) => !apiIds().has(id)), logTimeout)
      .toEqual([]);
  });
});
