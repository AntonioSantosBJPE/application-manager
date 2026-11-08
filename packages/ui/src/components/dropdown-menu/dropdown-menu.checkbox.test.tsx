import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

function Harness({ keepOpen = true, onToggle = vi.fn() }: { keepOpen?: boolean; onToggle?: (value: string) => void }) {
  const [on, setOn] = useState<string[]>(['mid']);
  const toggle = (value: string) => {
    onToggle(value);
    setOn((list) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]));
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button intent="secondary">Nível</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content aria-label="Nível">
        {['junior', 'mid', 'senior'].map((value) => (
          <DropdownMenu.CheckboxItem
            key={value}
            checked={on.includes(value)}
            onSelect={(event) => {
              if (keepOpen) event.preventDefault();
              toggle(value);
            }}
          >
            {value}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole('button', { name: 'Nível' }).focus();
  await user.keyboard('{Enter}');
}

describe('DropdownMenu checkbox items', () => {
  it('APP-46 announces each option as a menuitemcheckbox with aria-checked, not as a radio', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getByRole('menuitemcheckbox', { name: 'mid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'junior' })).toHaveAttribute('aria-checked', 'false');
  });

  it('APP-46 toggles with Space and Enter and keeps the menu open when the caller prevents the close', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    await open(user);

    // The focus opens on the first item (junior).
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenLastCalledWith('junior');
    expect(screen.getByRole('menuitemcheckbox', { name: 'junior' })).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('menuitemcheckbox', { name: 'junior' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menu', { name: 'Nível' })).toBeInTheDocument();
  });

  it('closes the menu after a choice when the caller does not prevent it', async () => {
    const user = userEvent.setup();
    render(<Harness keepOpen={false} />);
    await open(user);

    await user.keyboard('{Enter}');

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
