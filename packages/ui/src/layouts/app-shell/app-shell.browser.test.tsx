import { render, screen } from '@testing-library/react';
import { LayoutDashboard, Mail } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { Button } from '../../components/button';
import { DashboardPage } from '../dashboard-page';
import { AppShell } from './app-shell';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

const longName = 'Maria Aparecida de Albuquerque e Souza Vasconcelos Figueiredo '.repeat(2).slice(0, 100);

function renderShell(name = 'Marina Alves') {
  return render(
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação da administração">
        <AppShell.Brand tag="admin" />
        <AppShell.Section title="Administração">
          <AppShell.NavItem href="/admin" current icon={LayoutDashboard} count="3">
            Painel
          </AppShell.NavItem>
          <AppShell.NavItem href="/admin/invitations" icon={Mail}>
            Convites
          </AppShell.NavItem>
          <AppShell.NavItem href="/status">Status do sistema</AppShell.NavItem>
        </AppShell.Section>
        <AppShell.User initials="MA" name={name}>
          <Button intent="ghost" size="sm">
            Sair
          </Button>
        </AppShell.User>
      </AppShell.Sidebar>
      <AppShell.Main asChild>
        <DashboardPage.Root>
          <AppShell.Topbar>
            <span>Painel</span>
            <Button size="sm">Convidar pessoa</Button>
          </AppShell.Topbar>
          <DashboardPage.Header>
            <h1>Administração</h1>
          </DashboardPage.Header>
        </DashboardPage.Root>
      </AppShell.Main>
    </AppShell.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('AppShell in the browser', () => {
  it('PRU-04 AC01 measures the sidebar 232px on surface-raised with a right border, in both themes', async () => {
    await page.viewport(1280, 800);
    renderShell();
    const sidebar = screen.getByRole('navigation', { name: 'Navegação da administração' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(sidebar);
      const style = getComputedStyle(sidebar);
      expect(sidebar.getBoundingClientRect().width).toBe(232);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-raised'));
      expect(style.borderRightWidth).toBe('1px');
      expect(style.borderRightColor, theme).toBe(tokenColor('border'));
      expect(style.borderBottomWidth).toBe('0px');
    }
  });

  it('PRU-04 AC03 measures a nav item 30px with a 14px icon and the count in mono, the current one on accent-subtle', async () => {
    await page.viewport(1280, 800);
    renderShell();
    const current = screen.getByRole('link', { name: /Painel/ });
    const other = screen.getByRole('link', { name: 'Convites' });

    expect(current.getBoundingClientRect().height).toBe(30);
    expect(other.getBoundingClientRect().height).toBe(30);
    expect(current.querySelector('svg')!.getBoundingClientRect().width).toBe(14);
    expect(getComputedStyle(screen.getByText('3')).fontFamily).toMatch(/^"Geist Mono Variable"/);
    // The count sits at the right end of the item.
    expect(current.getBoundingClientRect().right - screen.getByText('3').getBoundingClientRect().right)
      .toBeLessThanOrEqual(9);

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(current);
      const style = getComputedStyle(current);
      expect(style.backgroundColor, theme).toBe(tokenColor('accent-subtle'));
      expect(style.color, theme).toBe(tokenColor('accent-text'));
      expect(getComputedStyle(other).backgroundColor, theme).toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(other).color, theme).toBe(tokenColor('text-muted'));
    }
  });

  it('PRU-04 AC04 keeps the archetype as the only main and lets it fill the content area', async () => {
    await page.viewport(1280, 800);
    renderShell();

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('data-archetype', 'dashboard');
    const sidebar = screen.getByRole('navigation').getBoundingClientRect();
    expect(mains[0]!.getBoundingClientRect().left).toBe(sidebar.right);
    expect(mains[0]!.getBoundingClientRect().right).toBe(1280);
  });

  it('PRU-04 AC05 turns the sidebar into a bar on top at 360px, with no horizontal scroll and "Sair" in view', async () => {
    await page.viewport(360, 800);
    renderShell(longName);
    const navigation = screen.getByRole('navigation');
    const main = screen.getByRole('main');
    const signOut = screen.getByRole('button', { name: 'Sair' });

    expect(navigation.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      main.getBoundingClientRect().top,
    );
    expect(navigation.getBoundingClientRect().width).toBe(360);
    expect(getComputedStyle(navigation).borderBottomWidth).toBe('1px');
    expect(getComputedStyle(navigation).borderRightWidth).toBe('0px');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    expect(signOut.getBoundingClientRect().right).toBeLessThanOrEqual(360);
    expect(signOut.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    // The long name is cut with an ellipsis rather than pushing "Sair" out.
    const name = screen.getByText(longName);
    expect(getComputedStyle(name).textOverflow).toBe('ellipsis');
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    for (const item of screen.getAllByRole('link')) {
      expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(360);
    }

    await page.viewport(1280, 800);
    expect(navigation.getBoundingClientRect().right).toBeLessThanOrEqual(
      main.getBoundingClientRect().left,
    );
    expect(navigation.getBoundingClientRect().top).toBe(main.getBoundingClientRect().top);
  });

  it('PRU-04 AC02 keeps the person at the bottom of the sidebar from md up, with "Sair" visible for a 100-character name', async () => {
    await page.viewport(1280, 800);
    renderShell(longName);
    const navigation = screen.getByRole('navigation').getBoundingClientRect();
    const person = screen.getByText(longName);
    const signOut = screen.getByRole('button', { name: 'Sair' }).getBoundingClientRect();

    expect(navigation.bottom - signOut.bottom).toBeLessThanOrEqual(24);
    expect(signOut.right).toBeLessThanOrEqual(navigation.right);
    expect(person.getBoundingClientRect().right).toBeLessThanOrEqual(signOut.left);
    expect(getComputedStyle(person).textOverflow).toBe('ellipsis');
  });

  it('PRU-04 AC06 draws a 48px topbar with the title at the left and the actions at the right', async () => {
    await page.viewport(1280, 800);
    renderShell();
    const title = screen.getByText('Painel', { selector: 'span' });
    const topbar = title.parentElement!;
    const action = screen.getByRole('button', { name: 'Convidar pessoa' });

    expect(topbar.getBoundingClientRect().height).toBe(48);
    expect(getComputedStyle(topbar).borderBottomWidth).toBe('1px');
    const bar = topbar.getBoundingClientRect();
    expect(title.getBoundingClientRect().left - bar.left).toBe(24);
    expect(bar.right - action.getBoundingClientRect().right).toBe(24);
  });
});
