import { fireEvent, render, screen, within } from '@testing-library/react';
import { LayoutDashboard, Mail } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../components/button';
import { DashboardPage } from '../dashboard-page';
import { ListPage } from '../list-page';
import { AppShell } from './app-shell';

function renderShell(onNavigate = vi.fn()) {
  return render(
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.NavItem href="/" current onClick={(event) => event.preventDefault()}>
          Início
        </AppShell.NavItem>
        <AppShell.NavItem
          href="/admin/invitations"
          onClick={(event) => {
            event.preventDefault();
            onNavigate();
          }}
        >
          Convites
        </AppShell.NavItem>
      </AppShell.Sidebar>
      <AppShell.Main>
        <h1>Início</h1>
      </AppShell.Main>
    </AppShell.Root>,
  );
}

describe('AppShell', () => {
  it('renders a named navigation landmark and the main landmark', () => {
    renderShell();

    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Início' }),
    );
  });

  it('puts the navigation before the content in the document, so a narrow screen stacks it on top', () => {
    renderShell();

    const navigation = screen.getByRole('navigation');
    const main = screen.getByRole('main');
    // Stacked by a column on the narrow layout: the navigation must come first in the DOM.
    expect(navigation.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Convites' })).not.toHaveAttribute('aria-current');
  });

  it('navigates with the item the user clicks', () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);

    fireEvent.click(screen.getByRole('link', { name: 'Convites' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('takes the navigation label from the caller, with no copy of its own', () => {
    render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Áreas do produto">
          <AppShell.NavItem href="/">Início</AppShell.NavItem>
        </AppShell.Sidebar>
        <AppShell.Main>Conteúdo</AppShell.Main>
      </AppShell.Root>,
    );

    expect(screen.getByRole('navigation', { name: 'Áreas do produto' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
  });

  it('renders the child element instead of a link when asChild is set', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Navegação principal">
          <AppShell.NavItem asChild current onClick={(event) => {
            event.preventDefault();
            onClick();
          }}>
            <a href="/admin">Administração</a>
          </AppShell.NavItem>
        </AppShell.Sidebar>
        <AppShell.Main>Conteúdo</AppShell.Main>
      </AppShell.Root>,
    );

    const link = screen.getByRole('link', { name: 'Administração' });
    expect(link).toHaveAttribute('href', '/admin');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('a')).toHaveLength(1);

    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the shell so the screens can be told apart', () => {
    renderShell();

    expect(screen.getByRole('navigation').parentElement).toHaveAttribute(
      'data-archetype',
      'shell',
    );
  });

  it('keeps exactly one main landmark when the content is a list archetype', () => {
    render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Navegação principal">
          <AppShell.NavItem href="/admin/invitations">Convites</AppShell.NavItem>
        </AppShell.Sidebar>
        <AppShell.Main asChild>
          <ListPage.Root>
            <ListPage.Header>
              <h1>Convites pendentes</h1>
            </ListPage.Header>
            <ListPage.Content>
              <p>ana@example.com</p>
            </ListPage.Content>
          </ListPage.Root>
        </AppShell.Main>
      </AppShell.Root>,
    );

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('data-archetype', 'list');
    expect(mains[0]).toContainElement(screen.getByRole('heading', { name: 'Convites pendentes' }));
    // The shell classes reach the archetype, so the content area still fills the frame.
    expect(mains[0]).toHaveClass('flex-1');
  });

  it('keeps exactly one main landmark when the content is a dashboard archetype', () => {
    render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Navegação principal">
          <AppShell.NavItem href="/admin">Administração</AppShell.NavItem>
        </AppShell.Sidebar>
        <AppShell.Main asChild>
          <DashboardPage.Root>
            <DashboardPage.Header>
              <h1>Status</h1>
            </DashboardPage.Header>
            <DashboardPage.Grid>
              <p>Widget A</p>
            </DashboardPage.Grid>
          </DashboardPage.Root>
        </AppShell.Main>
      </AppShell.Root>,
    );

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('data-archetype', 'dashboard');
    expect(mains[0]).toContainElement(screen.getByText('Widget A'));
  });
});

function renderFullShell(onSignOut = vi.fn()) {
  return render(
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação da administração">
        <AppShell.Brand tag="admin" />
        <AppShell.Section title="Administração">
          <AppShell.NavItem asChild current icon={LayoutDashboard} count="3">
            <a href="/admin">Painel</a>
          </AppShell.NavItem>
          <AppShell.NavItem href="/admin/invitations" icon={Mail}>
            Convites
          </AppShell.NavItem>
        </AppShell.Section>
        <AppShell.User initials="MA" name="Marina Alves">
          <Button intent="ghost" size="sm" onClick={onSignOut}>
            Sair
          </Button>
        </AppShell.User>
      </AppShell.Sidebar>
      <AppShell.Main>
        <AppShell.Topbar>
          <span>Painel</span>
          <Button size="sm">Convidar pessoa</Button>
        </AppShell.Topbar>
      </AppShell.Main>
    </AppShell.Root>,
  );
}

describe('AppShell parts', () => {
  it('PRU-04 AC02 shows the logo, then the navigation by section, then the person with the sign-out action', () => {
    renderFullShell();

    const navigation = screen.getByRole('navigation', { name: 'Navegação da administração' });
    const wordmark = within(navigation).getByText('rumo');
    const group = within(navigation).getByRole('group', { name: 'Administração' });
    const person = within(navigation).getByText('Marina Alves');
    const signOut = within(navigation).getByRole('button', { name: 'Sair' });
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(wordmark, group)).toBe(true);
    expect(follows(group, person)).toBe(true);
    expect(follows(person, signOut)).toBe(true);
    expect(within(group).getAllByRole('link')).toHaveLength(2);
    expect(wordmark.parentElement?.textContent).toBe('rumo carreira');
  });

  it('PRU-05 AC07 shows the wordmark and the tag in the sidebar brand', () => {
    renderFullShell();

    const navigation = screen.getByRole('navigation');
    expect(within(navigation).getByText('rumo')).toBeInTheDocument();
    expect(within(navigation).getByText('carreira')).toBeInTheDocument();
    expect(within(navigation).getByText('admin')).toBeInTheDocument();
  });

  it('PRU-04 AC03 draws the icon, the label and the mono count, and marks only the current item', () => {
    renderFullShell();

    const current = screen.getByRole('link', { name: /Painel/ });
    const other = screen.getByRole('link', { name: 'Convites' });

    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('bg-accent-subtle', 'text-accent-text');
    expect(current.querySelector('svg')).not.toBeNull();
    expect(within(current).getByText('3')).toHaveClass('font-mono');
    expect(other).not.toHaveAttribute('aria-current');
    expect(other).not.toHaveClass('bg-accent-subtle');
    expect(other.querySelector('svg')).not.toBeNull();
    expect(within(other).queryByText('3')).toBeNull();
  });

  it('APP-43 separates the label from the count with a space, so the accessible name reads "Painel 3"', () => {
    renderFullShell();

    const current = screen.getByRole('link', { name: 'Painel 3' });
    expect(current.textContent).toContain('Painel 3');
    expect(within(current).getByText('3')).toHaveClass('font-mono', 'ml-auto');
  });

  it('PRU-04 AC04 keeps one link per item with asChild, icon and count inside the caller element', () => {
    const { container } = renderFullShell();

    const current = screen.getByRole('link', { name: /Painel/ });
    expect(current).toHaveAttribute('href', '/admin');
    expect(current).toHaveClass('h-7.5');
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('PRU-04 AC02 hides the initials from assistive technology and keeps the action working', () => {
    const onSignOut = vi.fn();
    renderFullShell(onSignOut);

    expect(screen.getByText('MA')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('PRU-04 AC06 puts the title and the page actions in the topbar', () => {
    renderFullShell();

    const topbar = screen.getByText('Painel', { selector: 'span' }).parentElement!;
    expect(topbar).toHaveClass('h-12');
    expect(within(topbar).getByRole('button', { name: 'Convidar pessoa' })).toBeInTheDocument();
  });
});
