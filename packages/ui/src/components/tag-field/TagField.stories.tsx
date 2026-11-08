import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import type { ComboboxOption } from '../combobox';
import { Field } from '../field';
import { TagField, type TagFieldTag } from './tag-field';

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'gama', label: 'Skill Fictícia Gama' },
  { id: 'delta', label: 'Skill Fictícia Delta' },
];

function Controlled({ initial, invalid = false }: { initial: string[]; invalid?: boolean }) {
  const [ids, setIds] = useState(initial);
  const [query, setQuery] = useState('');
  const tags: TagFieldTag[] = ids.map((id) => {
    const label = catalog.find((option) => option.id === id)!.label;
    return {
      id,
      label,
      variant: id === 'beta' ? 'nice' : 'required',
      removeLabel: `Remover ${label}`,
    };
  });
  const options = catalog.filter(
    (option) => !ids.includes(option.id) && option.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-3">
      {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
        <div key={surface} className={`w-112 p-4 ${surface}`}>
          <Field.Root invalid={invalid}>
            <Field.Label htmlFor={`skills-${surface}`}>Skills</Field.Label>
            <TagField
              id={`skills-${surface}`}
              tags={tags}
              onRemove={(id) => setIds((current) => current.filter((item) => item !== id))}
              query={query}
              options={options}
                  onQueryChange={setQuery}
              onSelect={(option) => setIds((current) => [...current, option.id])}
            />
            <Field.Error>Informe ao menos uma skill.</Field.Error>
          </Field.Root>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/TagField',
  component: TagField,
  args: {
    tags: [],
    onRemove: () => {},
    query: '',
    options: [],
    onQueryChange: () => {},
    onSelect: () => {},
    'aria-label': 'Skills',
  },
  render: () => <Controlled initial={['alfa', 'beta']} />,
} satisfies Meta<typeof TagField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    const [alfa] = canvas.getAllByRole('button', { name: 'Remover Skill Fictícia Alfa' });
    await userEvent.click(alfa!);
    // Both surfaces share the same tags, so the tag is gone from each of them.
    await expect(canvas.queryAllByRole('button', { name: 'Remover Skill Fictícia Alfa' })).toHaveLength(0);
    await expect(canvas.getAllByRole('button', { name: 'Remover Skill Fictícia Beta' })).toHaveLength(2);
  },
};

export const Vazio: Story = {
  name: 'Sem tags',
  render: () => <Controlled initial={[]} />,
  play: async ({ canvas }) => {
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.getAllByRole('combobox', { name: 'Skills' })).toHaveLength(2);
  },
};

/** The tags and the field text at 4.5:1, and the one focus ring around the box at 3:1. */
const contrast: Story['play'] = async ({ canvas }) => {
  for (const button of canvas.getAllByRole('button')) await expectContrast(button, 4.5);
  for (const input of canvas.getAllByRole('combobox')) await expectContrast(input, 4.5);
  const [input] = canvas.getAllByRole('combobox');
  input!.focus();
  await expect(input).toHaveFocus();
  const ring = focusRing(input!.closest('div')!.parentElement!);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  play: contrast,
};

export const InvalidoClaro: Story = {
  name: 'Inválido, tema claro',
  globals: { theme: 'light' },
  render: () => <Controlled initial={[]} invalid />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('combobox')[0]).toHaveAttribute('aria-invalid', 'true');
  },
};

export const InvalidoEscuro: Story = {
  name: 'Inválido, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Controlled initial={[]} invalid />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('combobox')[0]).toHaveAttribute('aria-invalid', 'true');
  },
};
