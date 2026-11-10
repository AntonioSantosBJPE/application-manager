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

describe('FormPage index link and item', () => {
  function renderIndex() {
    return render(
      <FormPage.Index aria-label="Seções">
        <FormPage.IndexLink href="#a">Perfil</FormPage.IndexLink>
        <FormPage.IndexLink href="#b" current count={3}>
          Experiência
        </FormPage.IndexLink>
        <FormPage.IndexLink href="#c" count={0}>
          Projetos
        </FormPage.IndexLink>
        <FormPage.IndexLink href="#d" count={12}>
          Idiomas
        </FormPage.IndexLink>
      </FormPage.Index>,
    );
  }

  it('RES-37 marks only the current link with aria-current="page"', () => {
    renderIndex();

    expect(screen.getByRole('link', { name: 'Experiência 3' })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Perfil', 'Projetos', 'Idiomas 12']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });

  it('RES-37 shows the count in monospace and omits it when it is zero or absent', () => {
    renderIndex();

    const three = within(screen.getByRole('link', { name: 'Experiência 3' })).getByText('3');
    expect(three).toHaveClass('font-mono');
    expect(within(screen.getByRole('link', { name: 'Idiomas 12' })).getByText('12')).toHaveClass('font-mono');
    expect(screen.getByRole('link', { name: 'Perfil' }).textContent).toBe('Perfil');
    expect(screen.getByRole('link', { name: 'Projetos' }).textContent).toBe('Projetos');
  });

  it('RES-37 keeps the link a real link and hands the count to a router link through asChild', () => {
    render(
      <FormPage.IndexLink asChild count={2}>
        <a href="/resume?section=projects">Projetos</a>
      </FormPage.IndexLink>,
    );

    const link = screen.getByRole('link', { name: 'Projetos 2' });
    expect(link).toHaveAttribute('href', '/resume?section=projects');
    expect(link).toHaveTextContent('Projetos 2');
  });

  it('RES-49 composes an item with a handle, a header with its text and actions, and a body', () => {
    render(
      <FormPage.Item aria-label="Experiência">
        <FormPage.ItemHeader
          handle={<button type="button">Mover</button>}
          actions={<button type="button">Editar</button>}
        >
          <span>Título</span>
          <span>Subtítulo</span>
        </FormPage.ItemHeader>
        <FormPage.ItemBody>
          <p>Corpo</p>
        </FormPage.ItemBody>
      </FormPage.Item>,
    );

    const item = screen.getByRole('article', { name: 'Experiência' });
    expect(item).toHaveClass('rounded-md', 'border');
    const header = screen.getByText('Título').parentElement!.parentElement!;
    expect(Array.from(header.children).map((child) => child.textContent)).toEqual([
      'Mover',
      'TítuloSubtítulo',
      'Editar',
    ]);
    expect(item).toContainElement(screen.getByText('Corpo'));
    expect(
      Boolean(header.compareDocumentPosition(screen.getByText('Corpo')) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it('RES-49 draws the header without a handle or actions when the caller passes none', () => {
    render(
      <FormPage.Item>
        <FormPage.ItemHeader>
          <span>Título</span>
        </FormPage.ItemHeader>
      </FormPage.Item>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Título').parentElement!.parentElement!.children).toHaveLength(1);
  });
});
