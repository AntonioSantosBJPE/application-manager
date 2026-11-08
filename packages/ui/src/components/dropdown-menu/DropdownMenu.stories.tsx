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

const withSubmenu = () => (
  <div className="p-12">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button intent="secondary">Ações da candidatura</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Abrir</DropdownMenu.Item>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Nível</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.RadioGroup value="mid">
              <DropdownMenu.RadioItem value="junior">Júnior</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="mid">Pleno</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="senior">Sênior</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
);

/** Opens the submenu with the keyboard and judges it: the options at 4.5:1 and the chosen one marked. */
const submenuPlay: Story['play'] = async ({ canvas }) => {
  canvas.getByRole('button', { name: 'Ações da candidatura' }).focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{ArrowDown}');
  await expect(within(document.body).getByRole('menuitem', { name: 'Nível' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  const submenu = within(document.body).getByRole('menu', { name: 'Nível' });

  await expect(within(submenu).getByRole('menuitemradio', { name: 'Pleno' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  for (const item of within(submenu).getAllByRole('menuitemradio')) await expectContrast(item, 4.5);
};

export const SubmenuClaro: Story = {
  name: 'Submenu com escolha, tema claro',
  globals: { theme: 'light' },
  render: withSubmenu,
  play: submenuPlay,
};

export const SubmenuEscuro: Story = {
  name: 'Submenu com escolha, tema escuro',
  globals: { theme: 'dark' },
  render: withSubmenu,
  play: submenuPlay,
};
