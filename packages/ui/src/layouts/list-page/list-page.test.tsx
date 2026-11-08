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

  it('renders a row as a list item whose text can take the whole line', () => {
    render(
      <ul>
        <ListPage.Row>
          <ListPage.RowText>ana@example.com</ListPage.RowText>
          <button type="button">Revogar</button>
        </ListPage.Row>
      </ul>,
    );

    const item = screen.getByRole('listitem');
    expect(item).toHaveClass('flex-wrap');
    expect(screen.getByText('ana@example.com')).toHaveClass('basis-full');
  });
});

describe('ListPage parts', () => {
  it('PRU-04 AC09 puts the title, the count in mono and the primary action in the header', () => {
    const { container } = render(
      <ListPage.Root>
        <ListPage.Header>
          <h1>Candidaturas</h1>
          <span className="font-mono">24</span>
          <button type="button" className="ml-auto">
            Nova
          </button>
        </ListPage.Header>
      </ListPage.Root>,
    );

    const header = container.querySelector('header')!;
    expect(header).toHaveClass('text-heading-md', 'min-h-12');
    expect(within(header).getByRole('heading', { name: 'Candidaturas' })).toBeInTheDocument();
    expect(within(header).getByText('24')).toHaveClass('font-mono');
    expect(within(header).getByRole('button', { name: 'Nova' })).toBeInTheDocument();
  });

  it('PRU-04 AC10 exposes the filters as a search landmark named by the caller', () => {
    render(
      <ListPage.Root>
        <ListPage.Filters aria-label="Filtros de candidaturas" />
      </ListPage.Root>,
    );

    expect(screen.getByRole('search', { name: 'Filtros de candidaturas' })).toBeInTheDocument();
  });

  it('PRU-04 AC11 shows the group label with its count', () => {
    render(
      <ListPage.Content>
        <ListPage.Group count={2}>Em entrevistas</ListPage.Group>
      </ListPage.Content>,
    );

    const group = screen.getByRole('heading', { level: 2, name: /Em entrevistas/ });
    expect(group).toHaveClass('h-9', 'bg-surface-raised', 'text-heading-sm');
    expect(within(group).getByText('2')).toHaveClass('font-mono', 'text-text-muted');
  });

  it('PRU-04 AC12 marks a selected row and keeps the others unmarked', () => {
    render(
      <ul>
        <ListPage.Row selected>
          <ListPage.RowText>Acme Pagamentos</ListPage.RowText>
        </ListPage.Row>
        <ListPage.Row>
          <ListPage.RowText>Nimbus Saúde</ListPage.RowText>
          <ListPage.RowMeta>
            <span className="font-mono">há 5 d</span>
          </ListPage.RowMeta>
        </ListPage.Row>
      </ul>,
    );

    const [selected, other] = screen.getAllByRole('listitem');
    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(selected).toHaveClass('bg-accent-subtle', 'min-h-row');
    expect(other).not.toHaveAttribute('aria-current');
    expect(other).toHaveClass('hover:bg-surface-hover');
    expect(within(other!).getByText('há 5 d').parentElement).toHaveClass('text-text-muted');
  });
});
