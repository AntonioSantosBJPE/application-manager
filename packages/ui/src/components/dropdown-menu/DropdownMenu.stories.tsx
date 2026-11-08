import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu.Root,
  args: { onOpenChange: fn() },
  render: (args) => (
    <div className="p-12">
      <DropdownMenu.Root {...args}>
        <DropdownMenu.Trigger asChild>
          <Button intent="ghost" size="sm" icon={Ellipsis} aria-label="Ações de Skill Fictícia Alfa" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Editar</DropdownMenu.Item>
          <DropdownMenu.Item>Apelidos</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  ),
} satisfies Meta<typeof DropdownMenu.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }));

    const menu = within(document.body).getByRole('menu');
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  },
};

/** Opens the menu with the keyboard and judges it: each item at 4.5:1 on the overlay surface. */
const contrast: Story['play'] = async ({ canvas }) => {
  canvas.getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }).focus();
  await userEvent.keyboard('{Enter}');
  const menu = within(document.body).getByRole('menu');

  for (const item of within(menu).getAllByRole('menuitem')) await expectContrast(item, 4.5);
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
