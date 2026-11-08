import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('PRU-07 AC03 shows the sentence of the caller and the action, and nothing else', () => {
    const onCreate = vi.fn();
    const { container } = render(
      <EmptyState.Root>
        <p>Nenhum convite pendente. Convide a primeira pessoa.</p>
        <EmptyState.Action>
          <Button onClick={onCreate}>Convidar pessoa</Button>
        </EmptyState.Action>
      </EmptyState.Root>,
    );

    expect(screen.getByText('Nenhum convite pendente. Convide a primeira pessoa.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Convidar pessoa' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('Nenhum convite pendente. Convide a primeira pessoa.Convidar pessoa');
    // No illustration: no image and no svg of its own.
    expect(container.querySelector('img, svg')).toBeNull();
  });

  it('PRU-07 AC03 draws the dashed border-strong box with radius-md and the muted sentence', () => {
    const { container } = render(
      <EmptyState.Root>
        <p>Sem itens.</p>
      </EmptyState.Root>,
    );

    expect(container.firstElementChild).toHaveClass(
      'border-dashed',
      'border-border-strong',
      'rounded-md',
      'text-text-muted',
      'items-start',
    );
  });

  it('PRU-07 AC03 works without an action', () => {
    render(
      <EmptyState.Root>
        <p>Sem itens.</p>
      </EmptyState.Root>,
    );

    expect(screen.getByText('Sem itens.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
