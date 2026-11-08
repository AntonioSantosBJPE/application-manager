import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('PRU-07 AC01 renders a kbd element with the key the caller gives', () => {
    render(<Kbd>⌘</Kbd>);

    const key = screen.getByText('⌘');
    expect(key.tagName).toBe('KBD');
    expect(key).toHaveClass('font-mono', 'text-kbd', 'h-4.5', 'border-border-strong', 'bg-surface-raised');
  });

  it('PRU-07 AC01 makes a sequence of keys one kbd each', () => {
    const { container } = render(
      <span>
        <Kbd>G</Kbd>
        <Kbd>C</Kbd>
      </span>,
    );

    expect([...container.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(['G', 'C']);
  });

  it('PRU-07 AC02 takes on-accent for text and border inside a primary Button', () => {
    render(
      <Button intent="primary">
        Nova candidatura <Kbd tone="on-accent">C</Kbd>
      </Button>,
    );

    const key = screen.getByText('C');
    expect(screen.getByRole('button')).toContainElement(key);
    expect(key).toHaveClass('text-on-accent', 'border-on-accent', 'bg-transparent');
    expect(key).not.toHaveClass('text-text-muted', 'border-border-strong');
  });

  it('PRU-07 AC11 renders nothing of its own without a child', () => {
    const { container } = render(<Kbd />);

    expect(container.querySelector('kbd')).toHaveTextContent('');
  });
});
