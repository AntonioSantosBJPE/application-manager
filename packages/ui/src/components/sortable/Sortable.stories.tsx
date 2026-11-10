import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { Sortable, type SortableAnnouncements } from './sortable';

const names: Record<string, string> = { a: 'Empresa Fictícia Alfa', b: 'Empresa Fictícia Beta', c: 'Empresa Fictícia Gama' };

const announcements: SortableAnnouncements = {
  onPick: ({ id, position, total }) => `Pegou ${names[id]}, posição ${position} de ${total}.`,
  onMove: ({ id, position, total }) => `${names[id]}, posição ${position} de ${total}.`,
  onDrop: ({ id, position, total }) => `Soltou ${names[id]}, posição ${position} de ${total}.`,
  onCancel: ({ id, position }) => `Cancelado. ${names[id]} voltou à posição ${position}.`,
};

function Lista() {
  const [ids, setIds] = useState(['a', 'b', 'c']);
  return (
    <div className="w-96 bg-surface p-4 text-text">
      <Sortable.List
        aria-label="Experiências"
        ids={ids}
        onReorder={setIds}
        announcements={announcements}
        instructions="Espaço ou Enter pega o item, as setas movem, Espaço ou Enter solta e Esc cancela."
        roleDescription="item arrastável"
        className="flex flex-col gap-2"
      >
        {ids.map((id) => (
          <Sortable.Item
            key={id}
            id={id}
            className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-2 py-3"
          >
            <Sortable.Handle label={`Mover ${names[id]}`} />
            <span className="text-body">{names[id]}</span>
          </Sortable.Item>
        ))}
      </Sortable.List>
    </div>
  );
}

const meta = {
  title: 'Components/Sortable',
  component: Sortable.List,
  args: {
    ids: [],
    onReorder: () => {},
    'aria-label': 'Experiências',
    announcements,
    instructions: '',
  },
  render: () => <Lista />,
} satisfies Meta<typeof Sortable.List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeVisible();
  },
};

/** Keyboard: focus the handle, `Espaço` picks, an arrow moves, `Espaço` drops. */
export const Teclado: Story = {
  name: 'Teclado',
  play: async ({ canvas }) => {
    canvas.getByRole('button', { name: 'Mover Empresa Fictícia Alfa' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');

    await waitFor(() =>
      expect(canvas.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Empresa Fictícia Beta',
        'Empresa Fictícia Alfa',
        'Empresa Fictícia Gama',
      ]),
    );
  },
};

/** The handle at 3:1 (an icon) and its focus ring drawn with the focus token. */
const contrast: Story['play'] = async ({ canvas }) => {
  const handles = canvas.getAllByRole('button');
  for (const handle of handles) await expectContrast(handle, 3);
  handles[0]!.focus();
  const ring = focusRing(handles[0]!);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
  for (const item of canvas.getAllByRole('listitem')) await expectContrast(item, 4.5);
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
