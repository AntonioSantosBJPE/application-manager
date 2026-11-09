import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

function Harness({ onStatus = vi.fn() }: { onStatus?: (value: string) => void }) {
  const [status, setStatus] = useState('applied');
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button intent="ghost" size="sm" icon={Ellipsis} aria-label="Ações da candidatura" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Abrir</DropdownMenu.Item>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Status</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.RadioGroup
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                onStatus(value);
              }}
            >
              <DropdownMenu.RadioItem value="saved">Salva</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="applied">Enviada</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="offer">Proposta</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

async function openSubmenu(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole('button', { name: 'Ações da candidatura' }).focus();
  await user.keyboard('{Enter}');
  await user.keyboard('{ArrowDown}');
  await user.keyboard('{ArrowRight}');
}

describe('DropdownMenu submenu and radio items', () => {
  it('APP-50 keeps the submenu closed until the right arrow, and marks it as a popup', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'Ações da candidatura' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}');

    const trigger = screen.getByRole('menuitem', { name: 'Status' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);

    await user.keyboard('{ArrowRight}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Salva',
      'Enviada',
      'Proposta',
    ]);
  });

  it('APP-50 marks the current value with aria-checked and moves the focus into the submenu', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await openSubmenu(user);

    expect(screen.getByRole('menuitemradio', { name: 'Enviada' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Salva' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'Proposta' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menu', { name: 'Status' })).toContainElement(document.activeElement as HTMLElement);
  });

  it('APP-50 closes the submenu with the left arrow and gives the focus back to its trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openSubmenu(user);

    await user.keyboard('{ArrowLeft}');

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getByRole('menuitem', { name: 'Status' })).toHaveFocus();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('APP-50 chooses an option with Enter, reports it once and marks it the next time', async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();
    render(<Harness onStatus={onStatus} />);
    await openSubmenu(user);

    // The focus enters on the first option (Salva); two arrows reach Proposta.
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith('offer');
    expect(screen.queryByRole('menu')).toBeNull();

    await openSubmenu(user);
    expect(screen.getByRole('menuitemradio', { name: 'Proposta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Enviada' })).toHaveAttribute('aria-checked', 'false');
  });

  it('APP-68 keeps the menu non-modal by default, so the page around it is not hidden', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>Conteúdo da página</p>
        <Harness />
      </div>,
    );

    await openSubmenu(user);

    expect(screen.getByText('Conteúdo da página')).toBeVisible();
    expect(screen.getByText('Conteúdo da página').closest('[aria-hidden="true"]')).toBeNull();
  });
});
