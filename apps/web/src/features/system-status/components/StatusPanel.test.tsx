// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ServiceState } from '../model/system-status';
import { StatusPanel, StatusWidgets } from './StatusPanel';

const text: Record<ServiceState, string> = {
  operational: 'Operacional',
  unavailable: 'Indisponível',
};

describe('StatusPanel', () => {
  const combinations: [ServiceState, ServiceState][] = [
    ['operational', 'operational'],
    ['operational', 'unavailable'],
    ['unavailable', 'operational'],
    ['unavailable', 'unavailable'],
  ];

  it.each(combinations)('shows API %s and Banco de dados %s', (api, database) => {
    render(<StatusPanel status={{ api, database, checkedAt: '2026-11-08T17:32:07.000Z' }} />);

    const apiRow = screen.getByRole('group', { name: 'API' });
    const databaseRow = screen.getByRole('group', { name: 'Banco de dados' });
    expect(within(apiRow).getByText('API')).toBeInTheDocument();
    expect(within(apiRow).getByText(text[api])).toBeInTheDocument();
    expect(
      within(apiRow).queryByText(text[api === 'operational' ? 'unavailable' : 'operational']),
    ).toBeNull();
    expect(within(databaseRow).getByText('Banco de dados')).toBeInTheDocument();
    expect(within(databaseRow).getByText(text[database])).toBeInTheDocument();
    expect(
      within(databaseRow).queryByText(
        text[database === 'operational' ? 'unavailable' : 'operational'],
      ),
    ).toBeNull();
    expect(screen.getByRole('main')).toContainElement(apiRow);
  });
});

const readAt = '2026-11-08T17:32:07.000Z';
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Componentes' }))
    .getAllByRole('group')
    .map((row) => row.getAttribute('aria-label'));

describe('StatusPanel as the PageStatus', () => {
  it('PRU-06 AC21 shows the wordmark, the h1, the verdict, the read instant and the rows', () => {
    render(
      <StatusPanel status={{ api: 'operational', database: 'operational', checkedAt: readAt }} />,
    );

    const main = screen.getByRole('main');
    expect(within(main).getByText('rumo')).toBeInTheDocument();
    expect(within(main).getByText('carreira')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Status');
    const verdict = screen.getByRole('heading', { level: 2 });
    expect(verdict.textContent).toBe('Todos os sistemas operacionais');
    expect(verdict).toHaveClass('text-heading-lg');
    const checked = screen.getByText(/^Verificado às/);
    expect(checked.textContent).toBe('Verificado às 14:32:07 de 08 nov 2026.');
    expect(within(checked).getByText('14:32:07')).toHaveClass('font-mono');
    expect(rowNames()).toEqual(['API', 'Banco de dados']);
    expect(screen.getByRole('group', { name: 'API' }).textContent).toBe('APIOperacional');
    expect(screen.getByRole('group', { name: 'Banco de dados' }).textContent).toBe(
      'Banco de dadosOperacional',
    );
    expect(within(main).getByRole('list', { name: 'Componentes' }).parentElement).toHaveClass(
      'max-w-140',
    );
    expect(screen.queryByText('Serviço degradado')).toBeNull();
  });

  it('PRU-06 AC22 says Serviço degradado and puts the unavailable database at the top in danger', () => {
    render(
      <StatusPanel status={{ api: 'operational', database: 'unavailable', checkedAt: readAt }} />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Serviço degradado');
    expect(screen.queryByText('Todos os sistemas operacionais')).toBeNull();
    expect(rowNames()).toEqual(['Banco de dados', 'API']);
    const database = screen.getByRole('group', { name: 'Banco de dados' });
    expect(within(database).getByText('Banco de dados')).toHaveClass('text-danger');
    expect(within(database).getByText('Indisponível')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'API' })).getByText('API')).not.toHaveClass(
      'text-danger',
    );
  });

  it('PRU-06 AC22 keeps the API on top in danger when the API is the one down', () => {
    render(
      <StatusPanel status={{ api: 'unavailable', database: 'unavailable', checkedAt: readAt }} />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Serviço degradado');
    expect(rowNames()).toEqual(['API', 'Banco de dados']);
    expect(within(screen.getByRole('group', { name: 'API' })).getByText('API')).toHaveClass(
      'text-danger',
    );
  });

  it('leaves the read line out when the instant is not a date', () => {
    render(
      <StatusPanel status={{ api: 'operational', database: 'operational', checkedAt: 'x' }} />,
    );

    expect(screen.queryByText(/Verificado/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Todos os sistemas operacionais',
    );
  });
});

describe('StatusWidgets', () => {
  it('PRU-06 AC14 shows the widget Status do sistema with the badges, API, Banco de dados and the read time', () => {
    render(
      <StatusWidgets status={{ api: 'operational', database: 'operational', checkedAt: readAt }} />,
    );

    const widget = screen.getByRole('region', { name: 'Status do sistema' });
    expect(within(widget).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Status do sistema',
    );
    expect(within(widget).getByRole('group', { name: 'API' }).textContent).toBe('APIOperacional');
    expect(within(widget).getByRole('group', { name: 'Banco de dados' }).textContent).toBe(
      'Banco de dadosOperacional',
    );
    const time = within(widget).getByText('08 nov 2026 14:32:07');
    expect(time).toHaveClass('font-mono');
    expect(time.previousElementSibling).toHaveTextContent('Verificado');
    expect(within(widget).getAllByText('Operacional')).toHaveLength(3);
  });

  it('PRU-06 AC14 marks the widget degraded and the unavailable component', () => {
    render(
      <StatusWidgets status={{ api: 'operational', database: 'unavailable', checkedAt: readAt }} />,
    );

    const widget = screen.getByRole('region', { name: 'Status do sistema' });
    expect(within(widget).getByText('Degradado')).toBeInTheDocument();
    expect(within(widget).getByRole('group', { name: 'Banco de dados' })).toHaveTextContent(
      'Indisponível',
    );
    expect(within(widget).getByRole('group', { name: 'API' })).toHaveTextContent('Operacional');
  });
});
