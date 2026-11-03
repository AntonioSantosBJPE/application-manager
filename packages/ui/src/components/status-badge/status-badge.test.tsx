import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the received text with the operational token classes', () => {
    render(<StatusBadge intent="operational">Operacional</StatusBadge>);

    const badge = screen.getByText('Operacional');
    expect(badge).toHaveClass('text-status-operational', 'border-status-operational');
    expect(badge).not.toHaveClass('text-status-unavailable');
  });

  it('renders the received text with the unavailable token classes', () => {
    render(<StatusBadge intent="unavailable">Indisponível</StatusBadge>);

    const badge = screen.getByText('Indisponível');
    expect(badge).toHaveClass('text-status-unavailable', 'border-status-unavailable');
    expect(badge).not.toHaveClass('text-status-operational');
  });

  it('passes the classes to the child when asChild is set', () => {
    const { container } = render(
      <StatusBadge intent="operational" asChild>
        <a href="/status">Ver status</a>
      </StatusBadge>,
    );

    const link = screen.getByRole('link', { name: 'Ver status' });
    expect(link).toHaveAttribute('href', '/status');
    expect(link).toHaveClass('text-status-operational', 'border-status-operational');
    expect(container.querySelector('span')).toBeNull();
  });
});
