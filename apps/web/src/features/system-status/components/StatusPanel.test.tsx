// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ServiceState } from '../model/system-status';
import { StatusPanel } from './StatusPanel';

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
