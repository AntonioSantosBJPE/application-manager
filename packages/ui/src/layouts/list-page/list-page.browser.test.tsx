import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Button } from '../../components/button';
import { AppShell } from '../app-shell';
import { settle } from '../../testing/contrast';
import { ListPage } from './list-page';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderList(narrow = false) {
  return render(
    <ListPage.Root>
      <ListPage.Header>
        <h1>Candidaturas</h1>
        <span className="font-mono text-text-muted">24</span>
        <Button size="sm" className="ml-auto">
          Nova
        </Button>
      </ListPage.Header>
      <ListPage.Filters aria-label="Filtros de candidaturas">
        <Button intent="secondary" size="sm">
          Ativas
        </Button>
      </ListPage.Filters>
      <ListPage.Content>
        <ListPage.Group count={2}>Em entrevistas</ListPage.Group>
        <ul>
          <ListPage.Row selected>
            <ListPage.RowText>Acme Pagamentos</ListPage.RowText>
            <ListPage.RowMeta>
              <span className="w-24 font-mono">há 2 d</span>
              <span className="w-24 font-mono">12 nov 2026</span>
            </ListPage.RowMeta>
          </ListPage.Row>
          <ListPage.Row>
            <ListPage.RowText>
              {narrow ? 'um-endereco-muito-longo-de-exemplo-sem-quebra@empresa-ficticia-exemplo.com' : 'Nimbus Saúde'}
            </ListPage.RowText>
            <ListPage.RowMeta>
              <span className="w-24 font-mono">há 5 d</span>
              <span className="w-24 font-mono">09 nov 2026</span>
            </ListPage.RowMeta>
          </ListPage.Row>
        </ul>
      </ListPage.Content>
    </ListPage.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('ListPage in the browser', () => {
  it('PRU-04 AC09 paints the title in heading-md, the count in mono and the action sm at the right of a 48px topbar', async () => {
    await page.viewport(1280, 800);
    const { container } = renderList();
    const header = container.querySelector('header')!;
    const title = screen.getByRole('heading', { name: 'Candidaturas' });
    const count = screen.getByText('24');
    const action = screen.getByRole('button', { name: 'Nova' });

    expect(header.getBoundingClientRect().height).toBe(48);
    expect(getComputedStyle(title).fontSize).toBe('15px');
    expect(getComputedStyle(title).fontWeight).toBe('600');
    expect(getComputedStyle(count).fontFamily).toMatch(/^"Geist Mono Variable"/);
    expect(action.getBoundingClientRect().height).toBe(28);
    expect(header.getBoundingClientRect().right - action.getBoundingClientRect().right).toBe(24);
    expect(count.getBoundingClientRect().left).toBeGreaterThan(title.getBoundingClientRect().right);
    expect(count.getBoundingClientRect().right).toBeLessThan(action.getBoundingClientRect().left);
  });

  it('PRU-04 AC11 measures the group header 36px on surface-raised with the label in heading-sm and the count', async () => {
    await page.viewport(1280, 800);
    renderList();
    const group = screen.getByRole('heading', { level: 2 });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(group);
      expect(group.getBoundingClientRect().height).toBe(36);
      expect(getComputedStyle(group).backgroundColor, theme).toBe(tokenColor('surface-raised'));
      expect(getComputedStyle(group).fontSize).toBe('13px');
      expect(getComputedStyle(group).fontWeight).toBe('600');
      expect(getComputedStyle(screen.getByText('2')).color, theme).toBe(tokenColor('text-muted'));
    }
  });

  it('PRU-04 AC12 measures a row 40px at least, hovers on surface-hover, selects on accent-subtle and aligns the metadata', async () => {
    await page.viewport(1280, 800);
    renderList();
    const [selected, other] = screen.getAllByRole('listitem');

    expect(selected!.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
    expect(other!.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(selected!);
      expect(getComputedStyle(selected!).backgroundColor, theme).toBe(tokenColor('accent-subtle'));
      expect(getComputedStyle(other!).backgroundColor, theme).toBe('rgba(0, 0, 0, 0)');
      await userEvent.hover(other!);
      await settle(other!);
      expect(getComputedStyle(other!).backgroundColor, theme).toBe(tokenColor('surface-hover'));
      await userEvent.unhover(other!);
    }
    // The gutter is space-6 padding on both sides, with no side border, and the fill still runs edge
    // to edge: the row's own background is what the first and the last pixel of the line show.
    const row = selected!.getBoundingClientRect();
    const middle = row.top + row.height / 2;
    expect(getComputedStyle(selected!).paddingLeft).toBe('24px');
    expect(getComputedStyle(selected!).paddingRight).toBe('24px');
    expect(getComputedStyle(selected!).borderLeftWidth).toBe('0px');
    expect(getComputedStyle(selected!).borderRightWidth).toBe('0px');
    expect(getComputedStyle(selected!).borderBottomColor).toBe(tokenColor('border'));
    expect(row.width).toBe(1280);
    expect(screen.getByText('Acme Pagamentos').getBoundingClientRect().left).toBe(24);
    expect(getComputedStyle(selected!).backgroundClip).toBe('border-box');
    expect(document.elementFromPoint(0, middle)).toBe(selected);
    expect(document.elementFromPoint(1279, middle)).toBe(selected);
    // The metadata sits at the right in fixed columns: every row's cells share the same left edges.
    const cells = (row: HTMLElement) => [...row.querySelectorAll('span.font-mono')].map((c) => c.getBoundingClientRect());
    const [a, b] = [cells(selected!), cells(other!)];
    expect(a[0]!.left).toBe(b[0]!.left);
    expect(a[1]!.left).toBe(b[1]!.left);
    expect(a[0]!.width).toBe(96);
    expect(selected!.getBoundingClientRect().right - a[1]!.right).toBeGreaterThanOrEqual(24);
    expect(getComputedStyle(screen.getByText('há 2 d')).fontFamily).toMatch(/^"Geist Mono Variable"/);
  });

  it('PRU-04 AC12 cuts a long text with an ellipsis and keeps the metadata in view at 360px', async () => {
    await page.viewport(360, 800);
    renderList(true);
    const text = screen.getByText(/um-endereco-muito-longo/);

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(screen.getByText('09 nov 2026').getBoundingClientRect().right).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  });

  it('PRU-04 a ListPage inside AppShell.Main asChild fills the row beside the sidebar, even when the child drops the props', async () => {
    await page.viewport(1280, 800);
    // A router outlet renders the page and forwards nothing, so the classes `asChild` hands down never arrive.
    const Outlet = () => (
      <ListPage.Root>
        <ListPage.Header>
          <h1>Candidaturas</h1>
        </ListPage.Header>
        <ListPage.Content>
          <ul>
            <ListPage.Row>
              <ListPage.RowText>Acme Pagamentos</ListPage.RowText>
            </ListPage.Row>
          </ul>
        </ListPage.Content>
      </ListPage.Root>
    );
    const { container } = render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Navegação principal">
          <AppShell.Brand />
        </AppShell.Sidebar>
        <AppShell.Main asChild>
          <Outlet />
        </AppShell.Main>
      </AppShell.Root>,
    );

    const sidebar = screen.getByRole('navigation', { name: 'Navegação principal' }).getBoundingClientRect();
    const list = container.querySelector('main')!.getBoundingClientRect();

    expect(sidebar.width).toBe(232);
    expect(list.left).toBe(sidebar.right);
    expect(list.right).toBe(1280);
  });
});
