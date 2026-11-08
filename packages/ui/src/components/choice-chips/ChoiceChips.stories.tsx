import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { Field } from '../field';
import { ChoiceChips } from './choice-chips';

const levels = [
  { value: 'intern', label: 'Estágio' },
  { value: 'junior', label: 'Júnior' },
  { value: 'mid', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'expert', label: 'Especialista' },
];

function Controlled({ initial, invalid = false }: { initial: string | null; invalid?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-3">
      {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
        <div key={surface} className={`p-4 ${surface}`}>
          <Field.Root invalid={invalid}>
            <Field.Label id={`nivel-${surface}`}>Nível</Field.Label>
            <ChoiceChips
              aria-labelledby={`nivel-${surface}`}
              options={levels}
              value={value}
              onValueChange={setValue}
            />
            <Field.Error>Escolha um nível.</Field.Error>
          </Field.Root>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/ChoiceChips',
  component: ChoiceChips,
  args: { options: levels, value: 'mid', onValueChange: () => {}, 'aria-label': 'Nível' },
  render: () => <Controlled initial="mid" />,
} satisfies Meta<typeof ChoiceChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    const [group] = canvas.getAllByRole('radiogroup');
    await expect(group).toBeVisible();
    const [first] = canvas.getAllByRole('radio', { name: 'Sênior' });
    await userEvent.click(first!);
    await expect(first).toHaveAttribute('aria-checked', 'true');
  },
};

export const SemEscolha: Story = {
  name: 'Sem escolha',
  render: () => <Controlled initial={null} />,
  play: async ({ canvas }) => {
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).toHaveAttribute('aria-checked', 'false');
  },
};

/** The label of each chip at 4.5:1 and the focus ring at 3:1, in the chosen and the not chosen state. */
const contrast = (invalid: boolean): Story['play'] =>
  async ({ canvas }) => {
    const radios = canvas.getAllByRole('radio');
    await expect(radios).toHaveLength(10);
    for (const radio of radios) await expectContrast(radio, 4.5);
    await userEvent.tab();
    // The tab stop is the chosen chip (Pleno), or the first one when none is chosen (the invalid story).
    const ring = focusRing(radios[invalid ? 0 : 2]!);
    await expect(ring.drawn).toBe(true);
    await expect(ring.isFocusToken).toBe(true);
    if (invalid) await expect(canvas.getAllByRole('radiogroup')[0]).toHaveAttribute('aria-invalid', 'true');
  };

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Controlled initial="mid" />,
  play: contrast(false),
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Controlled initial="mid" />,
  play: contrast(false),
};

export const InvalidoClaro: Story = {
  name: 'Inválido, tema claro',
  globals: { theme: 'light' },
  render: () => <Controlled initial={null} invalid />,
  play: contrast(true),
};

export const InvalidoEscuro: Story = {
  name: 'Inválido, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Controlled initial={null} invalid />,
  play: contrast(true),
};
