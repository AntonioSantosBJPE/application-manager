import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { Button } from '../button';
import { Field } from '../field';
import { Dialog } from './dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog.Root,
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button intent="secondary">Editar</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Editar skill</Dialog.Title>
        <Dialog.Description>Corrija o nome ou a categoria.</Dialog.Description>
        <Field.Root>
          <Field.Label htmlFor="nome">Nome</Field.Label>
          <Field.Control id="nome" defaultValue="Skill Fictícia Alfa" />
        </Field.Root>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button intent="secondary">Cancelar</Button>
          </Dialog.Close>
          <Button intent="primary">Salvar</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  ),
} satisfies Meta<typeof Dialog.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Editar' }));

    const dialog = within(document.body).getByRole('dialog', { name: 'Editar skill' });
    await expect(dialog).toHaveTextContent('Corrija o nome ou a categoria.');
  },
};

/** Opens the dialog and judges it the way a person reads it: text at 4.5:1 and the focus ring at 3:1. */
const contrast: Story['play'] = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Editar' }));
  const dialog = within(document.body).getByRole('dialog', { name: 'Editar skill' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
  const save = within(dialog).getByRole('button', { name: 'Salvar' });

  await expectContrast(within(dialog).getByRole('heading', { name: 'Editar skill' }), 4.5);
  await expectContrast(within(dialog).getByText('Corrija o nome ou a categoria.'), 4.5);
  await expectContrast(within(dialog).getByLabelText('Nome'), 4.5);
  await expectContrast(cancel, 4.5);
  await expectContrast(save, 4.5);

  cancel.focus();
  await userEvent.tab({ shift: true });
  const input = within(dialog).getByLabelText('Nome');
  await expect(input).toHaveFocus();
  const ring = focusRing(input);
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
