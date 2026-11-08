import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from '../field';
import { Combobox, type ComboboxOption } from './combobox';

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'drizzle', label: 'Drizzle ORM de Teste' },
];

/** Filters the way a caller would, so the component is judged on what it does with the options. */
function Harness({
  onSelect = () => {},
  onQueryChange = () => {},
}: {
  onSelect?: (option: ComboboxOption | null) => void;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const options = query === '' ? catalog : catalog.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <Combobox
        aria-label="Skill"
        query={query}
        options={options}
        selected={selected}
        onQueryChange={(value) => {
          setQuery(value);
          onQueryChange(value);
        }}
        onSelect={(option) => {
          setSelected(option);
          onSelect(option);
        }}
      />
      <output aria-label="Escolhida">{selected === null ? 'nenhuma' : selected.id}</output>
    </div>
  );
}

const box = () => screen.getByRole('combobox', { name: 'Skill' });

describe('Combobox', () => {
  it('is a closed combobox with the ARIA 1.2 wiring until the person types', () => {
    render(<Harness />);

    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveAttribute('aria-autocomplete', 'list');
    expect(box()).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('option')).toBeNull();
    const list = document.getElementById(box().getAttribute('aria-controls')!);
    expect(list).toHaveAttribute('role', 'listbox');
  });

  it('reports the typed text and opens a listbox of the options with aria-controls pointing at it', async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onQueryChange={onQueryChange} />);

    await user.type(box(), 'fic');

    expect(onQueryChange.mock.calls.map(([q]) => q)).toEqual(['f', 'fi', 'fic']);
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Skill' });
    expect(box()).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Skill Fictícia Alfa',
      'Skill Fictícia Beta',
    ]);
  });

  it('moves the active option with the arrows, wraps at both ends and points aria-activedescendant at it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), 'fic');
    const [alfa, beta] = screen.getAllByRole('option');
    expect(box()).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-activedescendant', alfa!.id);
    await user.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-activedescendant', beta!.id);
    await user.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-activedescendant', alfa!.id);
    await user.keyboard('{ArrowUp}');
    expect(box()).toHaveAttribute('aria-activedescendant', beta!.id);
    expect(box()).toHaveFocus();
    expect(beta).toHaveAttribute('data-active');
    expect(alfa).not.toHaveAttribute('data-active');
  });

  it('opens on ArrowDown with the first option active and on ArrowUp with the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    box().focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]!.id).toBe(box().getAttribute('aria-activedescendant'));
    await user.keyboard('{Escape}');
    expect(box()).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[2]!.id).toBe(box().getAttribute('aria-activedescendant'));
  });

  it('chooses the active option on Enter: reports it, writes its label in the field and closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);
    await user.type(box(), 'drizzle');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith({ id: 'drizzle', label: 'Drizzle ORM de Teste' });
    expect(box()).toHaveValue('Drizzle ORM de Teste');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Escolhida')).toHaveTextContent('drizzle');
  });

  it('chooses with a click on an option and keeps the focus in the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), 'beta');

    await user.click(screen.getByRole('option', { name: 'Skill Fictícia Beta' }));

    expect(screen.getByLabelText('Escolhida')).toHaveTextContent('beta');
    expect(box()).toHaveValue('Skill Fictícia Beta');
    expect(box()).toHaveFocus();
  });

  it('marks only the chosen option aria-selected', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), 'beta');
    await user.keyboard('{ArrowDown}{Enter}');

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('option', { name: 'Skill Fictícia Beta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves selected empty when the person types without choosing, and when they edit after choosing', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(box(), 'Skill Fictícia Alfa');
    expect(screen.getByLabelText('Escolhida')).toHaveTextContent('nenhuma');
    expect(onSelect).not.toHaveBeenCalled();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Escolhida')).toHaveTextContent('alfa');

    await user.type(box(), 'x');
    expect(screen.getByLabelText('Escolhida')).toHaveTextContent('nenhuma');
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('does nothing on Enter when no option is active, so the form around it can submit', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Harness onSelect={onSelect} />
      </form>,
    );
    await user.type(box(), 'fic');

    await user.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit the form when Enter chooses an option', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    await user.type(box(), 'fic');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes on Esc and on blur, and stays closed with no options', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness />
        <button type="button">Fora</button>
      </div>,
    );

    await user.type(box(), 'fic');
    await user.keyboard('{Escape}');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(box()).toHaveAttribute('aria-expanded', 'false');

    await user.click(box());
    await user.keyboard('zzz');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('takes the description and the invalid state of the Field around it', () => {
    render(
      <Field.Root invalid>
        <Field.Label htmlFor="skill">Skill</Field.Label>
        <Combobox id="skill" query="" options={catalog} selected={null} onQueryChange={() => {}} onSelect={() => {}} />
        <Field.Error>Escolha uma skill da lista.</Field.Error>
      </Field.Root>,
    );

    expect(box()).toBeInvalid();
    expect(box()).toHaveAccessibleDescription('Escolha uma skill da lista.');
  });
});
