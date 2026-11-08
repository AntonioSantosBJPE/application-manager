import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './context-menu';

function Harness({ onOpen = vi.fn(), onStatus = vi.fn() }: { onOpen?: () => void; onStatus?: (v: string) => void }) {
  const [status, setStatus] = useState('applied');
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div tabIndex={0} data-testid="row">
          Empresa Fictícia Alfa
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item onSelect={onOpen}>Abrir</ContextMenu.Item>
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>Status</ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.RadioGroup
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                onStatus(value);
              }}
            >
              <ContextMenu.RadioItem value="saved">Salva</ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="applied">Enviada</ContextMenu.RadioItem>
            </ContextMenu.RadioGroup>
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

describe('ContextMenu', () => {
  it('APP-50 stays closed until the right click and then lists the items as menu items', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole('menu')).toBeNull();
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('row') });

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Abrir', 'Status']);
  });

  it('APP-50 does not open on the left click', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('row'));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('APP-50 runs onSelect of the chosen item once, closes, and Esc closes without choosing', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);

    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('row') });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('row') });
    await user.click(screen.getByRole('menuitem', { name: 'Abrir' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('APP-50 opens the submenu with the right arrow, marks the current value and closes it with the left arrow', async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();
    render(<Harness onStatus={onStatus} />);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('row') });
    act(() => screen.getByRole('menuitem', { name: 'Status' }).focus());
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('menuitemradio', { name: 'Enviada' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Salva' })).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('{ArrowLeft}');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getByRole('menuitem', { name: 'Status' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('menuitemradio', { name: 'Salva' }));
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith('saved');
  });

  it('APP-50 floats with the look of the DropdownMenu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('row') });

    expect(screen.getByRole('menu')).toHaveClass(
      'bg-surface-overlay',
      'border-border-strong',
      'rounded-md',
      'shadow-overlay',
      'min-w-50',
    );
    expect(screen.getByRole('menuitem', { name: 'Abrir' })).toHaveClass('h-7.5', 'rounded-sm', 'px-2');
  });
});
