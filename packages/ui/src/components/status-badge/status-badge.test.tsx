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

describe('StatusBadge in the Prumo', () => {
  it('PRU-02 AC12 leads the text with a dot, with border and text in the intent color over a transparent fill', () => {
    render(
      <>
        <StatusBadge intent="operational">Operacional</StatusBadge>
        <StatusBadge intent="unavailable">Indisponível</StatusBadge>
      </>,
    );

    for (const [text, intent] of [
      ['Operacional', 'operational'],
      ['Indisponível', 'unavailable'],
    ] as const) {
      const badge = screen.getByText(text);
      const dot = badge.firstElementChild;
      expect(dot?.tagName.toLowerCase()).toBe('svg');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
      expect(dot?.querySelector('circle')).toHaveAttribute('fill', 'currentColor');
      expect(badge.lastChild?.textContent).toBe(text);
      expect(badge).toHaveClass(`border-status-${intent}`, `text-status-${intent}`, 'bg-transparent');
      expect(badge).not.toHaveClass('bg-surface');
    }
  });

  it('PRU-02 AC12 keeps the dot before the text when asChild renders a link', () => {
    render(
      <StatusBadge intent="unavailable" asChild>
        <a href="/status">Indisponível</a>
      </StatusBadge>,
    );

    const link = screen.getByRole('link', { name: 'Indisponível' });
    expect(link.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(link).toHaveTextContent('Indisponível');
    expect(link).toHaveClass('bg-transparent', 'text-status-unavailable');
  });
});
