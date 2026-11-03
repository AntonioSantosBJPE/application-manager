import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './dashboard-page';

function renderPage() {
  return render(
    <DashboardPage.Root>
      <DashboardPage.Header>
        <h1>Status</h1>
      </DashboardPage.Header>
      <DashboardPage.Grid>
        <p>Widget A</p>
        <p>Widget B</p>
      </DashboardPage.Grid>
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
