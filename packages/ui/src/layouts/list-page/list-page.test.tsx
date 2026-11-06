import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListPage } from './list-page';

function renderPage(onFilter = vi.fn()) {
  return render(
    <ListPage.Root>
      <ListPage.Header>
        <h1>Convites pendentes</h1>
        <button type="button">Convidar</button>
      </ListPage.Header>
      <ListPage.Filters aria-label="Filtrar convites">
        <label htmlFor="pending-filter">E-mail</label>
        <input id="pending-filter" onChange={(event) => onFilter(event.target.value)} />
      </ListPage.Filters>
      <ListPage.Content>
        <p>ana@example.com</p>
        <p>bruno@example.com</p>
      </ListPage.Content>
    </ListPage.Root>,
  );
}

describe('ListPage', () => {
  it('renders the header, the filters and the content inside the main landmark', () => {
    const { container } = renderPage();

    const main = screen.getByRole('main');
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(main).toContainElement(header);
    expect(header).toContainElement(screen.getByRole('heading', { name: 'Convites pendentes' }));
    expect(main).toContainElement(screen.getByRole('search'));
    expect(main).toContainElement(screen.getByText('ana@example.com'));
    expect(main).toContainElement(screen.getByText('bruno@example.com'));
  });

  it('names the filter region with the caller label and keeps the controls reachable by keyboard', () => {
    const onFilter = vi.fn();
    renderPage(onFilter);

    const filters = screen.getByRole('search', { name: 'Filtrar convites' });
    const input = within(filters).getByLabelText('E-mail');
    fireEvent.change(input, { target: { value: 'ana' } });

    expect(input).toHaveValue('ana');
    expect(onFilter).toHaveBeenCalledWith('ana');
  });

  it('carries no label of its own, so the caller supplies the only one', () => {
    render(
      <ListPage.Root>
        <ListPage.Filters aria-label="Filtrar por e-mail" />
      </ListPage.Root>,
    );

    expect(screen.getByRole('search', { name: 'Filtrar por e-mail' })).toBeInTheDocument();
    expect(screen.queryByRole('search', { name: 'Filtros' })).toBeNull();
  });

  it('marks the archetype so the screens can be told apart', () => {
    renderPage();

    expect(screen.getByRole('main')).toHaveAttribute('data-archetype', 'list');
  });
});
