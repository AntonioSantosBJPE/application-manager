import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { ContextMenu } from './context-menu';

const row = () => (
  <div className="p-12">
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          tabIndex={0}
          data-testid="row"
          className="flex h-10 w-96 items-center border border-border px-3 text-body outline-focus focus-visible:outline-2"
        >
          Empresa Fictícia Alfa
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item>Abrir</ContextMenu.Item>
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>Status</ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.RadioGroup value="applied">
              <ContextMenu.RadioItem value="saved">Salva</ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="applied">Enviada</ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="offer">Proposta</ContextMenu.RadioItem>
            </ContextMenu.RadioGroup>
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </div>
);

const meta = {
  title: 'Components/ContextMenu',
  component: ContextMenu.Root,
  render: row,
} satisfies Meta<typeof ContextMenu.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.pointer({ keys: '[MouseRight]', target: canvas.getByText('Empresa Fictícia Alfa') });

    const menu = within(document.body).getByRole('menu');
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  },
};

/** Opens the menu on the right click, then the submenu with the keyboard, and judges each item at 4.5:1. */
const contrast: Story['play'] = async ({ canvas }) => {
  await userEvent.pointer({ keys: '[MouseRight]', target: canvas.getByText('Empresa Fictícia Alfa') });
  const menu = within(document.body).getByRole('menu');
  for (const item of within(menu).getAllByRole('menuitem')) await expectContrast(item, 4.5);

  within(menu).getByRole('menuitem', { name: 'Status' }).focus();
  await expect(within(menu).getByRole('menuitem', { name: 'Status' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect(within(document.body).getByRole('menuitemradio', { name: 'Enviada' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  for (const item of within(document.body).getAllByRole('menuitemradio')) await expectContrast(item, 4.5);
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
