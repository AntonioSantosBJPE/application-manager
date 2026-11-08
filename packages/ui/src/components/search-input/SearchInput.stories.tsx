import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { SearchInput } from './search-input';

const meta = {
  title: 'Components/SearchInput',
  component: SearchInput,
  args: { 'aria-label': 'Nome ou apelido', placeholder: 'Nome ou apelido', wrapperClassName: 'w-55' },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox', { name: 'Nome ou apelido' });
    await userEvent.type(input, 'postgres');
    await expect(input).toHaveValue('postgres');
  },
};

export const Preenchido: Story = {
  args: { defaultValue: 'nest' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('searchbox')).toHaveValue('nest');
  },
};

/** The field over `surface` and `surface-raised`. */
const fields = () => (
  <div className="flex flex-col gap-3">
    {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
      <div key={surface} className={`flex gap-3 p-4 ${surface}`}>
        <SearchInput aria-label="Nome ou apelido" placeholder="Nome ou apelido" wrapperClassName="w-55" />
        <SearchInput aria-label="Preenchido" defaultValue="postgres" wrapperClassName="w-55" />
      </div>
    ))}
  </div>
);

/** Typed text at 4.5:1, placeholder at 4.5:1, border at 3:1 and the focus ring at 3:1. */
const contrast: Story['play'] = async ({ canvasElement }) => {
  const inputs = [...canvasElement.querySelectorAll<HTMLInputElement>('input')];
  await expect(inputs).toHaveLength(4);
  for (const input of inputs) {
    await expectContrast(input, 3, 'borderTopColor');
    if (input.value !== '') await expectContrast(input, 4.5);
  }
  await userEvent.tab();
  const ring = focusRing(inputs[0]!);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
  await expect(ring.ratio).toBeGreaterThanOrEqual(3);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: fields,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: fields,
  play: contrast,
};
