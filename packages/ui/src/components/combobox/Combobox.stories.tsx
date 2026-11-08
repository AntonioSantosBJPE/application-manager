import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { Field } from '../field';
import { Combobox, type ComboboxOption } from './combobox';

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'drizzle', label: 'Drizzle ORM de Teste' },
];

/** The caller's side of the contract: it filters, keeps the query and keeps the choice. */
function Controlled({ invalid = false }: { invalid?: boolean }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const options = catalog.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="h-64 bg-surface p-4">
      <Field.Root invalid={invalid} className="w-72">
        <Field.Label htmlFor="skill">Skill</Field.Label>
        <Combobox
          id="skill"
          query={query}
          options={options}
          selected={selected}
          onQueryChange={setQuery}
          onSelect={setSelected}
        />
        <Field.Error>Escolha uma skill da lista.</Field.Error>
      </Field.Root>
      <p className="mt-2 text-caption text-text-muted">
        Escolhida: <span data-testid="chosen">{selected === null ? 'nenhuma' : selected.id}</span>
      </p>
    </div>
  );
}

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  render: () => <Controlled />,
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  args: { query: '', options: [], selected: null, onQueryChange: () => {}, onSelect: () => {} },
  play: async ({ canvas }) => {
    const box = canvas.getByRole('combobox', { name: 'Skill' });
    await userEvent.type(box, 'fic');
    await expect(within(document.body).getAllByRole('option')).toHaveLength(2);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(canvas.getByTestId('chosen')).toHaveTextContent('alfa');
    await expect(box).toHaveValue('Skill Fictícia Alfa');
  },
};

export const Invalido: Story = {
  name: 'Inválido',
  args: Padrao.args,
  render: () => <Controlled invalid />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Skill' })).toBeInvalid();
    await expect(canvas.getByText('Escolha uma skill da lista.')).toBeVisible();
  },
};

/** The list open with an active option: option text at 4.5:1 on the overlay surface, focus ring at 3:1. */
const contrast: Story['play'] = async ({ canvas }) => {
  const box = canvas.getByRole('combobox', { name: 'Skill' });
  await userEvent.type(box, 'fic');
  await userEvent.keyboard('{ArrowDown}');
  for (const option of within(document.body).getAllByRole('option')) await expectContrast(option, 4.5);
  const ring = focusRing(box);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
  await expect(ring.ratio).toBeGreaterThanOrEqual(3);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  args: Padrao.args,
  globals: { theme: 'light' },
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  args: Padrao.args,
  globals: { theme: 'dark' },
  play: contrast,
};
