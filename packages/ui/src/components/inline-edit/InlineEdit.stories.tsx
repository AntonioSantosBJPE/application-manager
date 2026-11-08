import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { InlineEdit } from './inline-edit';

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-3">
      {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
        <div key={surface} className={`w-80 p-4 ${surface}`}>
          <InlineEdit
            value={value}
            label={`Editar local em ${surface}`}
            emptyText="Sem local"
            onCommit={setValue}
          />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/InlineEdit',
  component: InlineEdit,
  args: { value: 'Recife, PE', label: 'Editar local', onCommit: () => {} },
  render: () => <Controlled initial="Recife, PE" />,
} satisfies Meta<typeof InlineEdit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^Editar local em bg-surface / }));
    await userEvent.keyboard('Olinda, PE{Enter}');

    await expect(canvas.getByRole('button', { name: /^Editar local em bg-surface / })).toHaveTextContent(
      'Olinda, PE',
    );
    await expect(canvas.getByRole('button', { name: /^Editar local em bg-surface-raised / })).toBeVisible();
  },
};

export const Vazio: Story = {
  name: 'Sem valor',
  render: () => <Controlled initial="" />,
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toHaveTextContent('Sem local');
  },
};

/** Reading and editing: the text at 4.5:1 and the focus ring at 3:1, on both surfaces. */
const contrast: Story['play'] = async ({ canvas }) => {
  const buttons = canvas.getAllByRole('button');
  for (const button of buttons) await expectContrast(button, 4.5);
  buttons[0]!.focus();
  const reading = focusRing(buttons[0]!);
  await expect(reading.drawn).toBe(true);
  await expect(reading.isFocusToken).toBe(true);

  await userEvent.keyboard('{Enter}');
  const field = canvas.getByRole('textbox');
  await expectContrast(field, 4.5);
  const editing = focusRing(field);
  await expect(editing.drawn).toBe(true);
  await expect(editing.isFocusToken).toBe(true);
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
