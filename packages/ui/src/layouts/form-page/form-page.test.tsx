import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormPage } from './form-page';

function renderPage(onAdd = vi.fn()) {
  return render(
    <FormPage.Root>
      <FormPage.Index aria-label="Seções do currículo">
        <a href="#perfil">Perfil</a>
        <a href="#experiencia">Experiência</a>
      </FormPage.Index>
      <FormPage.Content>
        <FormPage.Section
          id="perfil"
          title="Perfil"
          actions={
            <button type="button" onClick={onAdd}>
              Adicionar item
            </button>
          }
        >
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" />
        </FormPage.Section>
        <FormPage.Section id="experiencia" title="Experiência">
          <p>Sem itens.</p>
        </FormPage.Section>
      </FormPage.Content>
      <FormPage.Actions>
        <button type="button">Visualizar PDF</button>
      </FormPage.Actions>
    </FormPage.Root>,
  );
}

describe('FormPage', () => {
  it('PRU-07 AC10 renders a main with the index as a nav named by the caller', () => {
    renderPage();

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-archetype', 'form');
    const index = screen.getByRole('navigation', { name: 'Seções do currículo' });
    expect(main).toContainElement(index);
    expect(index).toHaveClass('md:w-50', 'md:sticky');
    expect(within(index).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Perfil',
      'Experiência',
    ]);
  });

  it('PRU-07 AC10 titles each section in heading-md and names the section by it', () => {
    renderPage();

    const section = screen.getByRole('region', { name: 'Perfil' });
    const title = within(section).getByRole('heading', { level: 2, name: 'Perfil' });
    expect(title).toHaveClass('text-heading-md');
    expect(screen.getByRole('region', { name: 'Experiência' })).toBeInTheDocument();
  });

  it('PRU-07 AC10 puts the actions of a section beside its title and keeps them working', () => {
    const onAdd = vi.fn();
    renderPage(onAdd);

    const section = screen.getByRole('region', { name: 'Perfil' });
    const title = within(section).getByRole('heading', { name: 'Perfil' });
    const add = within(section).getByRole('button', { name: 'Adicionar item' });
    expect(title.parentElement).toContainElement(add);
    fireEvent.click(add);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole('region', { name: 'Experiência' })).queryByRole('button')).toBeNull();
  });

  it('PRU-07 AC10 holds the sections in a reading column and the page actions after them', () => {
    renderPage();

    const content = screen.getByRole('region', { name: 'Perfil' }).parentElement!;
    expect(content).toHaveClass('md:max-w-form');
    const actions = screen.getByRole('button', { name: 'Visualizar PDF' }).parentElement!;
    expect(actions).toHaveClass('w-full', 'sticky');
    expect(
      Boolean(content.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
