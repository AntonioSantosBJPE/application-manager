import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from './filter-chip';

describe('FilterChip', () => {
  it('announces the pressed state', () => {
    render(
      <div>
        <FilterChip pressed>Todas</FilterChip>
        <FilterChip pressed={false}>Privadas</FilterChip>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Privadas' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws the pressed chip in surface-hover with text and the other in text-muted', () => {
    render(
      <div>
        <FilterChip pressed>Todas</FilterChip>
        <FilterChip pressed={false}>Privadas</FilterChip>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Todas' })).toHaveClass(
      'bg-surface-hover',
      'text-text',
      'border-border-control',
      'h-6.5',
      'text-caption',
    );
    expect(screen.getByRole('button', { name: 'Privadas' })).toHaveClass(
      'bg-surface',
      'text-text-muted',
      'border-border-strong',
    );
  });

  it('shows the count in font-mono, zero included, and nothing without it', () => {
    render(
      <div>
        <FilterChip pressed={false} count={4}>
          Privadas
        </FilterChip>
        <FilterChip pressed={false} count={0}>
          Vazias
        </FilterChip>
        <FilterChip pressed={false}>Todas</FilterChip>
      </div>,
    );

    expect(screen.getByText('4')).toHaveClass('font-mono');
    expect(screen.getByRole('button', { name: /^Privadas\s*4$/ })).toBeInTheDocument();
    expect(screen.getByText('0')).toHaveClass('font-mono');
    expect(screen.getByRole('button', { name: 'Todas' }).querySelector('span')).toBeNull();
  });

  it('is a plain button that calls onClick on click and on Enter', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChip pressed={false} onClick={onClick}>
        Privadas
      </FilterChip>,
    );
    const chip = screen.getByRole('button', { name: 'Privadas' });

    expect(chip).toHaveAttribute('type', 'button');
    await user.click(chip);
    chip.focus();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('passes className and other button props through', () => {
    render(
      <FilterChip pressed={false} className="shrink-0" disabled>
        Privadas
      </FilterChip>,
    );

    expect(screen.getByRole('button', { name: 'Privadas' })).toHaveClass('shrink-0');
    expect(screen.getByRole('button', { name: 'Privadas' })).toBeDisabled();
  });
});
