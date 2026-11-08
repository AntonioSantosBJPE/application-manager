import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge without intent', () => {
  it('SKL-40 renders the received text as a neutral badge with token classes and no dot', () => {
    const { container } = render(<StatusBadge>Privada</StatusBadge>);

    const badge = screen.getByText('Privada');
    expect(badge).toHaveClass('border-border-strong', 'text-text', 'h-5', 'rounded-sm');
    expect(badge.className).not.toMatch(/status-(operational|unavailable)/);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('SKL-40 keeps the dot on the badges that have an intent', () => {
    const { container } = render(<StatusBadge intent="operational">Operacional</StatusBadge>);

    expect(container.querySelector('svg')).not.toBeNull();
  });
});
