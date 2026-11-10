import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { Sortable, type SortableAnnouncements } from './sortable';

const names: Record<string, string> = { a: 'Alfa', b: 'Beta', c: 'Gama' };

const announcements: SortableAnnouncements = {
  onPick: ({ id, position, total }) => `pegou ${names[id]} na posição ${position} de ${total}`,
  onMove: ({ id, position, total }) => `${names[id]} na posição ${position} de ${total}`,
  onDrop: ({ id, position, total }) => `soltou ${names[id]} na posição ${position} de ${total}`,
  onCancel: ({ id, position }) => `cancelou ${names[id]}, de volta à posição ${position}`,
};

function Harness({ onReorder = vi.fn() }: { onReorder?: (ids: string[]) => void }) {
  const [ids, setIds] = useState(['a', 'b', 'c']);
  return (
    <Sortable.List
      aria-label="Itens"
      ids={ids}
      instructions="Espaço pega, setas movem, Espaço solta."
      announcements={announcements}
      roleDescription="item arrastável"
      onReorder={(next) => {
        setIds(next);
        onReorder(next);
      }}
    >
      {ids.map((id) => (
        <Sortable.Item key={id} id={id} className="flex h-12 items-center gap-2 border border-border">
          <Sortable.Handle label={`Mover ${names[id]}`} />
          <span>{names[id]}</span>
        </Sortable.Item>
      ))}
    </Sortable.List>
  );
}

const order = () => screen.getAllByRole('listitem').map((item) => item.textContent);
const handle = (name: string) => screen.getByRole('button', { name: `Mover ${name}` });
const liveRegion = () => document.querySelector('[role="status"][aria-live]')?.textContent ?? '';

/** A real pointer drag: press on the handle, cross the target in steps, release (the sensor needs moves). */
async function drag(from: HTMLElement, to: HTMLElement) {
  const center = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const start = center(from);
  const end = center(to);
  const session = cdp();
  const send = (type: 'mouseMoved' | 'mousePressed' | 'mouseReleased', point: { x: number; y: number }) =>
    session.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', buttons: 1, clickCount: 1 });
  await send('mouseMoved', start);
  await send('mousePressed', start);
  for (let step = 1; step <= 10; step += 1) {
    await send('mouseMoved', {
      x: start.x + ((end.x - start.x) * step) / 10,
      y: start.y + ((end.y - start.y) * step) / 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await send('mouseReleased', end);
}

describe('Sortable in the browser', () => {
  it('RES-70 dragging a handle onto another place calls onReorder with the new order', async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);

    await drag(handle('Gama'), handle('Alfa'));

    await expect.poll(() => onReorder.mock.calls).toEqual([[['c', 'a', 'b']]]);
    expect(order()).toEqual(['Gama', 'Alfa', 'Beta']);
  });

  it('RES-72 Space picks, the arrows move and Space drops, saving the new order and announcing each step', async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    handle('Alfa').focus();

    await userEvent.keyboard(' ');
    await expect.poll(liveRegion).toBe('pegou Alfa na posição 1 de 3');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(liveRegion).toBe('Alfa na posição 2 de 3');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(liveRegion).toBe('Alfa na posição 3 de 3');
    expect(onReorder).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');

    await expect.poll(liveRegion).toBe('soltou Alfa na posição 3 de 3');
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
    expect(order()).toEqual(['Beta', 'Gama', 'Alfa']);
  });

  it('RES-72 Enter picks and drops the same way', async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    handle('Gama').focus();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => onReorder.mock.calls).toEqual([[['a', 'c', 'b']]]);
  });

  it('RES-73 Esc gives the picked item its place back without calling onReorder', async () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    handle('Alfa').focus();

    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');

    await expect.poll(liveRegion).toBe('cancelou Alfa, de volta à posição 1');
    expect(onReorder).not.toHaveBeenCalled();
    expect(order()).toEqual(['Alfa', 'Beta', 'Gama']);
  });

  it('RES-76 reads the instructions and the role description of the handle from the caller', () => {
    render(<Harness />);

    expect(handle('Alfa')).toHaveAttribute('aria-roledescription', 'item arrastável');
    const describedBy = handle('Alfa').getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)?.textContent).toBe('Espaço pega, setas movem, Espaço solta.');
  });
});
