import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('announces a danger alert as an error with the danger token', () => {
    render(<Alert intent="danger">E-mail ou senha incorretos.</Alert>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    expect(alert).toHaveClass('border-danger', 'text-danger');
    expect(alert).not.toHaveClass('bg-surface-raised');
  });

  it('announces an info alert politely with the surface token', () => {
    render(<Alert intent="info">O link aparece uma única vez.</Alert>);

    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('O link aparece uma única vez.');
    expect(alert).toHaveClass('border-border', 'bg-surface-raised', 'text-text');
    expect(alert).not.toHaveClass('text-danger');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
