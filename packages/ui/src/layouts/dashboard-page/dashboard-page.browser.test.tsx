import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { AppShell } from '../app-shell';
import { DashboardPage } from './dashboard-page';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderDashboard() {
  return render(
    <DashboardPage.Root>
      <AppShell.Topbar data-testid="topbar">
        <b className="text-body font-medium">Painel</b>
      </AppShell.Topbar>
      <DashboardPage.Content data-testid="content">
        <DashboardPage.Header>
          <h1 className="text-heading-lg">Administração</h1>
          <p className="text-text-muted">Estado do produto.</p>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          <DashboardPage.Widget span={6} data-testid="a">
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Status do sistema</DashboardPage.Widget.Title>
            </DashboardPage.Widget.Header>
            <p>API operacional</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={6} data-testid="b">
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Convites pendentes</DashboardPage.Widget.Title>
              <DashboardPage.Widget.Action asChild>
                <a href="/admin/invitations">Ver convites</a>
              </DashboardPage.Widget.Action>
            </DashboardPage.Widget.Header>
            <p>3</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={4} data-testid="c">
            <p>Um terço</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={8} data-testid="d">
            <p>Dois terços</p>
          </DashboardPage.Widget>
          <DashboardPage.Widget span={12} data-testid="e">
            <p>Largura inteira</p>
          </DashboardPage.Widget>
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('DashboardPage in the browser', () => {
  it('PRU-04 AC13 paints a main without padding opened by the 48px topbar edge to edge, the content with 24px of padding at most 1120px wide, an h1 in heading-lg and a 12-column grid 16px apart', async () => {
    await page.viewport(1440, 900);
    const { container } = renderDashboard();
    const main = screen.getByRole('main');
    const topbar = screen.getByTestId('topbar');
    const content = screen.getByTestId('content');
    const title = screen.getByRole('heading', { level: 1 });
    const grid = content.querySelector(':scope > div')!;

    const mainStyle = getComputedStyle(main);
    expect([
      mainStyle.paddingTop,
      mainStyle.paddingRight,
      mainStyle.paddingBottom,
      mainStyle.paddingLeft,
    ]).toEqual(['0px', '0px', '0px', '0px']);
    expect(main.firstElementChild).toBe(topbar);
    const mainBox = main.getBoundingClientRect();
    const topbarBox = topbar.getBoundingClientRect();
    expect(topbarBox.height).toBe(48);
    expect(topbarBox.top).toBe(mainBox.top);
    expect(topbarBox.left).toBe(mainBox.left);
    expect(topbarBox.width).toBe(mainBox.width);
    expect(mainBox.width).toBeGreaterThan(1120);

    const style = getComputedStyle(content);
    expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual([
      '24px',
      '24px',
      '24px',
      '24px',
    ]);
    expect(content.getBoundingClientRect().width).toBe(1120);
    expect(content.getBoundingClientRect().top).toBe(topbarBox.bottom);
    expect(container.querySelectorAll('main > div')).toHaveLength(2);
    expect(getComputedStyle(title).fontSize).toBe('18px');
    expect(getComputedStyle(title).fontWeight).toBe('600');
    expect(getComputedStyle(screen.getByText('Estado do produto.')).color).toBe(tokenColor('text-muted'));
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ');
    expect(columns).toHaveLength(12);
    expect(getComputedStyle(grid).columnGap).toBe('16px');
    expect(getComputedStyle(grid).rowGap).toBe('16px');
  });

  it('PRU-04 AC14 paints the widget on surface with border, radius-md and 16px of padding, and takes the columns it asks for', async () => {
    await page.viewport(1440, 900);
    renderDashboard();
    const a = screen.getByTestId('a');
    const gridWidth = a.parentElement!.getBoundingClientRect().width;
    const column = (gridWidth - 11 * 16) / 12;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(a);
      const style = getComputedStyle(a);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border'));
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopLeftRadius).toBe('6px');
      expect(style.paddingTop).toBe('16px');
      expect(style.paddingLeft).toBe('16px');
    }
    for (const [id, span] of [['a', 6], ['b', 6], ['c', 4], ['d', 8], ['e', 12]] as const) {
      expect(screen.getByTestId(id).getBoundingClientRect().width, id).toBeCloseTo(
        span * column + (span - 1) * 16,
        1,
      );
    }
    // Two 6-column widgets share a row; the 4 and the 8 share the next one.
    expect(screen.getByTestId('a').getBoundingClientRect().top).toBe(
      screen.getByTestId('b').getBoundingClientRect().top,
    );
    expect(screen.getByTestId('c').getBoundingClientRect().top).toBe(
      screen.getByTestId('d').getBoundingClientRect().top,
    );
    expect(screen.getByTestId('e').getBoundingClientRect().top).toBeGreaterThan(
      screen.getByTestId('d').getBoundingClientRect().bottom,
    );
  });

  it('PRU-04 AC14 shows the title in heading-sm and the ghost action at the right end of the widget header', async () => {
    await page.viewport(1440, 900);
    renderDashboard();
    const title = screen.getByRole('heading', { level: 2, name: 'Convites pendentes' });
    const action = screen.getByRole('link', { name: 'Ver convites' });
    const widget = screen.getByTestId('b');

    expect(getComputedStyle(title).fontSize).toBe('13px');
    expect(getComputedStyle(title).fontWeight).toBe('600');
    expect(action.getBoundingClientRect().height).toBe(28);
    expect(getComputedStyle(action).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(action).color).toBe(tokenColor('text-muted'));
    expect(widget.getBoundingClientRect().right - action.getBoundingClientRect().right).toBe(17);
  });

  it('PRU-04 AC13 stacks the widgets in one column at 360px, with no horizontal scroll', async () => {
    await page.viewport(360, 800);
    renderDashboard();

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    const a = screen.getByTestId('a').getBoundingClientRect();
    const b = screen.getByTestId('b').getBoundingClientRect();
    expect(a.width).toBe(312);
    expect(b.top).toBeGreaterThanOrEqual(a.bottom);
    await page.viewport(1280, 800);
  });
});
