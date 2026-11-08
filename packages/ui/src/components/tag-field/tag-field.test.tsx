import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from '../field';
import type { ComboboxOption } from '../combobox';
import { TagField, type TagFieldTag } from './tag-field';

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'gama', label: 'Skill Fictícia Gama' },
];

function Harness({
  initial = ['alfa', 'beta'],
  invalid = false,
  onRemove = vi.fn(),
}: {
  initial?: string[];
  invalid?: boolean;
  onRemove?: (id: string) => void;
}) {
  const [ids, setIds] = useState(initial);
  const [query, setQuery] = useState('');
  const tags: TagFieldTag[] = ids.map((id) => {
    const label = catalog.find((option) => option.id === id)!.label;
    return { id, label, variant: 'required', removeLabel: `Remover ${label}` };
  });
  const options = catalog.filter(
    (option) => !ids.includes(option.id) && option.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Field.Root invalid={invalid}>
      <Field.Label htmlFor="skills">Skills</Field.Label>
      <TagField
        id="skills"
        tags={tags}
        onRemove={(id) => {
          setIds((current) => current.filter((item) => item !== id));
          onRemove(id);
        }}
        query={query}
        options={options}
        onQueryChange={setQuery}
        onSelect={(option) => setIds((current) => [...current, option.id])}
      />
      <Field.Error>Informe ao menos uma skill.</Field.Error>
    </Field.Root>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Skills' });
const tagNames = () =>
  screen
    .queryAllByRole('button', { name: /^Remover / })
    .map((button) => button.getAttribute('aria-label'));

describe('TagField', () => {
  it('APP-59 draws each chosen tag with a remove button named by the caller, before the field', () => {
    render(<Harness />);

    expect(tagNames()).toEqual(['Remover Skill Fictícia Alfa', 'Remover Skill Fictícia Beta']);
    expect(screen.getByText('Skill Fictícia Alfa')).toBeInTheDocument();
    expect(field()).toHaveValue('');
  });

  it('APP-59 removes a tag with its "×" and puts the focus back in the field', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Harness onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remover Skill Fictícia Alfa' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('alfa');
    expect(tagNames()).toEqual(['Remover Skill Fictícia Beta']);
    expect(field()).toHaveFocus();
  });

  it('APP-59 removes the last tag with Backspace in the empty field and keeps the focus there', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Harness onRemove={onRemove} />);
    field().focus();

    await user.keyboard('{Backspace}');

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('beta');
    expect(tagNames()).toEqual(['Remover Skill Fictícia Alfa']);
    expect(field()).toHaveFocus();

    await user.keyboard('{Backspace}');
    expect(tagNames()).toEqual([]);
    expect(field()).toHaveFocus();
  });

  it('APP-59 keeps the tags when Backspace edits typed text, and removes one only once the field is empty', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    field().focus();

    await user.keyboard('gam');
    await user.keyboard('{Backspace}');
    expect(field()).toHaveValue('ga');
    expect(tagNames()).toHaveLength(2);

    await user.keyboard('{Backspace}{Backspace}');
    expect(field()).toHaveValue('');
    expect(tagNames()).toHaveLength(2);

    await user.keyboard('{Backspace}');
    expect(tagNames()).toHaveLength(1);
  });

  it('APP-59 does nothing on Backspace when there is no tag', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Harness initial={[]} onRemove={onRemove} />);
    field().focus();

    await user.keyboard('{Backspace}');

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('APP-59 adds a tag by choosing an option of the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    field().focus();

    await user.keyboard('gam');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(tagNames()).toEqual([
      'Remover Skill Fictícia Alfa',
      'Remover Skill Fictícia Beta',
      'Remover Skill Fictícia Gama',
    ]);
    expect(field()).toHaveValue('');
  });

  it('APP-59 focuses the field when the empty part of the box is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field().closest('div')!.parentElement!);

    expect(field()).toHaveFocus();
  });

  it('APP-59 takes the invalid state and the description from Field.Root', () => {
    const { rerender } = render(<Harness />);
    expect(field()).not.toHaveAttribute('aria-invalid');

    rerender(<Harness invalid />);

    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription('Informe ao menos uma skill.');
    expect(within(field().closest('div')!.parentElement!).getAllByRole('button')).toHaveLength(2);
    expect(field().closest('div')!.parentElement).toHaveClass('border-danger');
  });
});
