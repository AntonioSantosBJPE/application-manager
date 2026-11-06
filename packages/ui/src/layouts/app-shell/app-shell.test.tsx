import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

function renderShell(onNavigate = vi.fn()) {
  return render(
    <AppShell.Root>
      <AppShell.Sidebar>
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

  it('renders the child element instead of a link when asChild is set', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AppShell.Root>
        <AppShell.Sidebar>
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
});
