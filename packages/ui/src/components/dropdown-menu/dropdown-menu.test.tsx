import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ellipsis } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

function renderMenu(onEdit = vi.fn(), onAliases = vi.fn()) {
  const user = userEvent.setup();
  render(
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button intent="ghost" size="sm" icon={Ellipsis} aria-label="Ações de Skill Fictícia Alfa" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onSelect={onEdit}>Editar</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onAliases}>Apelidos</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>,
  );
  return {
    user,
    onEdit,
    onAliases,
    trigger: screen.getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }),
  };
}

describe('DropdownMenu', () => {
  it('is closed until the trigger is used and then lists the items as menu items', async () => {
    const { user, trigger } = renderMenu();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar', 'Apelidos']);
  });

  it('moves the focus to the first item on Enter and between items with the arrow keys', async () => {
    const { user, trigger } = renderMenu();
    trigger.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Apelidos' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
  });

  it('closes on Esc and returns the focus to the trigger', async () => {
    const { user, trigger } = renderMenu();
    trigger.focus();
    await user.keyboard('{Enter}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('runs onSelect of the chosen item only, with Enter on the focused item, and closes', async () => {
    const { user, trigger, onEdit, onAliases } = renderMenu();
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}');

    await user.keyboard('{Enter}');

    expect(onAliases).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens with a click and runs onSelect on a click of an item', async () => {
    const { user, trigger, onEdit } = renderMenu();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('floats on the overlay surface with the menu look of the card', async () => {
    const { user, trigger } = renderMenu();
    await user.click(trigger);

    expect(screen.getByRole('menu')).toHaveClass(
      'bg-surface-overlay',
      'border-border-strong',
      'rounded-md',
      'shadow-overlay',
      'min-w-50',
    );
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveClass('h-7.5', 'rounded-sm', 'px-2');
  });
});
