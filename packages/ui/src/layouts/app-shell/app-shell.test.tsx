import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
