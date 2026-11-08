import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { DetailPage } from './detail-page';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderPage() {
  return render(
    <DetailPage.Root>
      <DetailPage.Main>
        <h1 className="text-heading-lg">Desenvolvedor Backend Pleno</h1>
      </DetailPage.Main>
      <DetailPage.Sidebar aria-label="Propriedades">
        <DetailPage.Properties>
          <DetailPage.Property name="Status">Em entrevistas</DetailPage.Property>
          <DetailPage.Property name="Nível">Pleno</DetailPage.Property>
        </DetailPage.Properties>
      </DetailPage.Sidebar>
    </DetailPage.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('DetailPage in the browser', () => {
  it('PRU-07 AC09 measures the sidebar 280px with a border on the left, beside the content', async () => {
    await page.viewport(1280, 800);
    renderPage();
    const sidebar = screen.getByRole('complementary');
    const content = screen.getByRole('heading', { level: 1 });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(sidebar);
      const style = getComputedStyle(sidebar);
      expect(sidebar.getBoundingClientRect().width).toBe(280);
      expect(style.borderLeftWidth).toBe('1px');
      expect(style.borderLeftColor, theme).toBe(tokenColor('border'));
      expect(style.borderTopWidth).toBe('0px');
    }
    expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(
      sidebar.getBoundingClientRect().left,
    );
    expect(sidebar.getBoundingClientRect().right).toBe(1280);
  });

  it('PRU-07 AC09 paints the name in caption text-muted and a 28px value row that takes surface-hover on hover', async () => {
    await page.viewport(1280, 800);
    renderPage();
    const name = screen.getByText('Status');
    const value = screen.getByText('Em entrevistas');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(value);
      expect(getComputedStyle(name).fontSize).toBe('12px');
      expect(getComputedStyle(name).color, theme).toBe(tokenColor('text-muted'));
      expect(value.getBoundingClientRect().height).toBe(28);
      expect(getComputedStyle(value).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      await userEvent.hover(value);
      await settle(value);
      expect(getComputedStyle(value).backgroundColor, theme).toBe(tokenColor('surface-hover'));
      await userEvent.unhover(value);
    }
    // Name and value share a line: the value starts after the 96px name column.
    expect(value.getBoundingClientRect().left).toBeGreaterThan(name.getBoundingClientRect().right);
  });

  it('PRU-07 AC09 puts the properties under the content at 360px, with no horizontal scroll', async () => {
    await page.viewport(360, 800);
    renderPage();
    const sidebar = screen.getByRole('complementary').getBoundingClientRect();
    const content = screen.getByRole('heading', { level: 1 }).getBoundingClientRect();

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    expect(sidebar.top).toBeGreaterThanOrEqual(content.bottom);
    expect(sidebar.width).toBe(360);
    await page.viewport(1280, 800);
  });
});
