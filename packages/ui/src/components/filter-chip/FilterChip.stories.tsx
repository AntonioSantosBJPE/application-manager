import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { FilterChip } from './filter-chip';

const meta = {
  title: 'Components/FilterChip',
  component: FilterChip,
  args: { pressed: false, children: 'Privadas', onClick: fn() },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas, args }) => {
    const chip = canvas.getByRole('button', { name: 'Privadas' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Pressionado: Story = {
  args: { pressed: true, children: 'Todas' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
  },
};

export const ComContagem: Story = {
  name: 'Com contagem',
  args: { count: 4 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /^Privadas\s*4$/ })).toBeVisible();
  },
};

/** The chips of a filter row, over `surface` and `surface-raised`. */
const chips = () => (
  <div className="flex flex-col gap-3">
    {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
      <div key={surface} className={`flex flex-wrap gap-2 p-4 ${surface}`}>
        <FilterChip pressed>Todas</FilterChip>
        <FilterChip pressed={false} count={4}>
          Privadas
        </FilterChip>
        <FilterChip pressed={false}>Linguagem</FilterChip>
        <FilterChip pressed>Banco de dados</FilterChip>
      </div>
    ))}
  </div>
);

/** The label at 4.5:1, and the focus ring at 3:1 on the first chip reached by the keyboard. */
const contrast: Story['play'] = async ({ canvasElement }) => {
  const buttons = [...canvasElement.querySelectorAll<HTMLElement>('button')];
  await expect(buttons).toHaveLength(8);
  for (const button of buttons) await expectContrast(button, 4.5);
  await userEvent.tab();
  const ring = focusRing(buttons[0]!);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: chips,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: chips,
  play: contrast,
};
