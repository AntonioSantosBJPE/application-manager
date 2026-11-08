import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './search-input';

function Controlled({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchInput
      aria-label="Nome ou apelido"
      placeholder="Nome ou apelido"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange?.(event.target.value);
      }}
    />
  );
}

describe('SearchInput', () => {
  it('is a search box named by the label of the caller', () => {
    render(<SearchInput aria-label="Nome ou apelido" />);

    const input = screen.getByRole('searchbox', { name: 'Nome ou apelido' });
    expect(input).toHaveAttribute('type', 'search');
  });

  it('takes its name from a label element too', () => {
    render(
      <div>
        <label htmlFor="busca">Buscar skill</label>
        <SearchInput id="busca" />
      </div>,
    );

    expect(screen.getByRole('searchbox', { name: 'Buscar skill' })).toBeInTheDocument();
  });

  it('draws the search icon hidden from assistive technology next to the input', () => {
    const { container } = render(<SearchInput aria-label="Nome ou apelido" />);

    const icon = container.querySelector('svg')!;
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('absolute', 'left-2', 'text-text-muted', 'pointer-events-none');
    expect(screen.getByRole('searchbox')).toHaveClass('pl-7', 'border-border-control', 'h-control-sm');
  });

  it('reports every typed character in order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);

    await user.type(screen.getByRole('searchbox'), 'nest');

    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['n', 'ne', 'nes', 'nest']);
    expect(screen.getByRole('searchbox')).toHaveValue('nest');
  });

  it('receives the focus by Tab and by a click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Antes</button>
        <SearchInput aria-label="Nome ou apelido" />
      </div>,
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole('searchbox')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Antes' }));
    await user.click(screen.getByRole('searchbox'));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('puts className on the input and wrapperClassName on the wrapper', () => {
    const { container } = render(
      <SearchInput aria-label="Nome ou apelido" className="text-caption" wrapperClassName="w-55" />,
    );

    expect(screen.getByRole('searchbox')).toHaveClass('text-caption');
    expect(container.firstElementChild).toHaveClass('w-55', 'relative');
  });
});
