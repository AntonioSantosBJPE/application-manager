import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderMenu() {
  render(
    <div className="bg-surface p-12">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button intent="secondary">Nível</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content aria-label="Nível">
          <DropdownMenu.CheckboxItem checked onSelect={(event) => event.preventDefault()}>
            Pleno
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={false} onSelect={(event) => event.preventDefault()}>
            Sênior
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>,
  );
  return screen.getByRole('button', { name: 'Nível' });
}

describe('DropdownMenu checkbox items in the browser', () => {
  it('APP-46 walks the options with the real arrows, and Space and Enter press them without closing the menu', async () => {
    renderMenu().focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Pleno' }));

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Sênior' }));
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('menu', { name: 'Nível' })).toBeTruthy();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Pleno' }).getAttribute('aria-checked')).toBe('true');
  });

  it('APP-46 draws the menu with the focus ring on the active option, in both themes, without axe violations', async () => {
    await page.viewport(1280, 800);
    renderMenu().focus();
    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'Nível' });
    const active = screen.getByRole('menuitemcheckbox', { name: 'Pleno' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(menu);
      const ring = focusRing(active);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(menu), theme).toEqual([]);
    }
  });
});
