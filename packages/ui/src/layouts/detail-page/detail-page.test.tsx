import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../app-shell';
import { DetailPage } from './detail-page';

function renderPage() {
  return render(
    <DetailPage.Root>
      <DetailPage.Main>
        <h1>Desenvolvedor Backend Pleno</h1>
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

describe('DetailPage', () => {
  it('PRU-07 AC09 renders a main with the content and a sidebar named by the caller', () => {
    renderPage();

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-archetype', 'detail');
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Desenvolvedor Backend Pleno' }));
    const sidebar = screen.getByRole('complementary', { name: 'Propriedades' });
    expect(main).toContainElement(sidebar);
    expect(sidebar).toHaveClass('md:w-properties', 'md:border-l');
  });

  it('PRU-07 AC09 takes the sidebar label from the caller, with no copy of its own', () => {
    render(
      <DetailPage.Root>
        <DetailPage.Sidebar aria-label="Detalhes da vaga" />
      </DetailPage.Root>,
    );

    expect(screen.getByRole('complementary', { name: 'Detalhes da vaga' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Propriedades' })).toBeNull();
  });

  it('PRU-07 AC09 shows each property as a name in caption text-muted and a value in a 28px row', () => {
    renderPage();

    const list = screen.getByRole('complementary').querySelector('dl')!;
    const names = [...list.querySelectorAll('dt')];
    const values = [...list.querySelectorAll('dd')];
    expect(names.map((name) => name.textContent)).toEqual(['Status', 'Nível']);
    expect(values.map((value) => value.textContent)).toEqual(['Em entrevistas', 'Pleno']);
    for (const name of names) expect(name).toHaveClass('text-caption', 'text-text-muted');
    for (const value of values) expect(value).toHaveClass('min-h-7', 'hover:bg-surface-hover');
  });

  it('PRU-07 AC09 stays the only main when the shell hands it the content area', () => {
    render(
      <AppShell.Root>
        <AppShell.Sidebar aria-label="Navegação principal">
          <AppShell.NavItem href="/">Início</AppShell.NavItem>
        </AppShell.Sidebar>
        <AppShell.Main asChild>
          <DetailPage.Root>
            <DetailPage.Main>Conteúdo</DetailPage.Main>
          </DetailPage.Root>
        </AppShell.Main>
      </AppShell.Root>,
    );

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(within(mains[0]!).getByText('Conteúdo')).toBeInTheDocument();
  });
});
