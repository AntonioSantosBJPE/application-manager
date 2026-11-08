import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../app-shell';
import { DashboardPage } from './dashboard-page';

function renderPage() {
  return render(
    <DashboardPage.Root>
      <DashboardPage.Content>
        <DashboardPage.Header>
          <h1>Status</h1>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          <p>Widget A</p>
          <p>Widget B</p>
        </DashboardPage.Grid>
      </DashboardPage.Content>
    </DashboardPage.Root>,
  );
}

describe('DashboardPage', () => {
  it('renders the main and header landmarks around the grid content', () => {
    const { container } = renderPage();

    const main = screen.getByRole('main');
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(main).toContainElement(header);
    expect(header).toContainElement(screen.getByRole('heading', { name: 'Status' }));
    expect(main).toContainElement(screen.getByText('Widget A'));
    expect(main).toContainElement(screen.getByText('Widget B'));
  });

  it('marks the archetype so the screens can be told apart', () => {
    const { container } = renderPage();

    expect(screen.getByRole('main')).toHaveAttribute('data-archetype', 'dashboard');
    expect(container.querySelectorAll('[data-archetype]')).toHaveLength(1);
  });

  it('uses only token classes, with no raw palette color or arbitrary value', () => {
    const { container } = renderPage();

    const classes = [container, ...container.querySelectorAll('*')]
      .flatMap((el) => [...el.classList])
      .filter(Boolean);
    expect(classes.length).toBeGreaterThan(0);
    for (const name of classes) {
      expect(name).not.toMatch(/\[.*\]/);
      expect(name).not.toMatch(
        /(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d|-(black|white)$/,
      );
    }
  });
});

describe('DashboardPage parts', () => {
  it('PRU-04 AC13 opens the main without padding with the topbar, then the content with the header the caller writes', () => {
    const { container } = render(
      <DashboardPage.Root>
        <AppShell.Topbar data-testid="topbar">
          <b>Painel</b>
        </AppShell.Topbar>
        <DashboardPage.Content data-testid="content">
          <DashboardPage.Header>
            <h1 className="text-heading-lg">Administração</h1>
            <p className="text-text-muted">Estado do produto.</p>
          </DashboardPage.Header>
        </DashboardPage.Content>
      </DashboardPage.Root>,
    );

    const main = screen.getByRole('main');
    const header = container.querySelector('header')!;
    for (const name of main.classList) expect(name).not.toMatch(/^(p|px|py|pt|pr|pb|pl)-/);
    expect(main.firstElementChild).toBe(screen.getByTestId('topbar'));
    const content = screen.getByTestId('content');
    expect(content).toHaveClass('p-6', 'max-w-content', 'flex-col', 'gap-6');
    expect(content).toContainElement(header);
    expect(within(header).getByRole('heading', { level: 1, name: 'Administração' })).toHaveClass(
      'text-heading-lg',
    );
    expect(within(header).getByText('Estado do produto.')).toHaveClass('text-text-muted');
  });

  it('PRU-04 AC14 offers the widget with its title, a ghost action and the spans 3 to 12', () => {
    const spans = [3, 4, 5, 6, 7, 8, 12] as const;
    render(
      <DashboardPage.Grid>
        {spans.map((span) => (
          <DashboardPage.Widget key={span} span={span} data-testid={`widget-${span}`}>
            <DashboardPage.Widget.Header>
              <DashboardPage.Widget.Title>Convites {span}</DashboardPage.Widget.Title>
              <DashboardPage.Widget.Action>Ver convites {span}</DashboardPage.Widget.Action>
            </DashboardPage.Widget.Header>
          </DashboardPage.Widget>
        ))}
      </DashboardPage.Grid>,
    );

    for (const span of spans) {
      const widget = screen.getByTestId(`widget-${span}`);
      expect(widget).toHaveClass(`md:col-span-${span}`, 'bg-surface', 'border-border', 'rounded-md', 'p-4');
      expect(within(widget).getByRole('heading', { level: 2, name: `Convites ${span}` })).toHaveClass(
        'text-heading-sm',
      );
      const action = within(widget).getByRole('button', { name: `Ver convites ${span}` });
      expect(action).toHaveClass('text-text-muted', 'h-control-sm');
    }
  });

  it('PRU-04 AC14 hands the widget action to a link with asChild and defaults the span to 12', () => {
    render(
      <DashboardPage.Widget data-testid="widget">
        <DashboardPage.Widget.Action asChild>
          <a href="/admin/invitations">Ver convites</a>
        </DashboardPage.Widget.Action>
      </DashboardPage.Widget>,
    );

    expect(screen.getByTestId('widget')).toHaveClass('md:col-span-12');
    expect(screen.getByRole('link', { name: 'Ver convites' })).toHaveAttribute(
      'href',
      '/admin/invitations',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
