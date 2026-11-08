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
          <Button intent="secondary">Ações</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Abrir</DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>Nível</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.RadioGroup value="mid">
                <DropdownMenu.RadioItem value="junior">Júnior</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="mid">Pleno</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="senior">Sênior</DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>,
  );
  return screen.getByRole('button', { name: 'Ações' });
}

describe('DropdownMenu submenu in the browser', () => {
  it('APP-50 opens with the real right arrow, walks the options, closes with the left arrow and returns the focus to the trigger item', async () => {
    renderMenu().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nível' }));

    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Júnior' }));
    expect(screen.getByRole('menuitemradio', { name: 'Pleno' }).getAttribute('aria-checked')).toBe('true');

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Pleno' }));

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nível' }));
  });

  it('APP-50 closes the whole menu on Esc and gives the focus back to the trigger', async () => {
    const trigger = renderMenu();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nível' }));
    await userEvent.keyboard('{ArrowRight}');

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('APP-50 draws the open submenu on the overlay surface with the focus ring on the active option, in both themes, without axe violations', async () => {
    await page.viewport(1280, 800);
    renderMenu().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nível' }));
    await userEvent.keyboard('{ArrowRight}');
    const submenu = screen.getByRole('menu', { name: 'Nível' });
    const active = screen.getByRole('menuitemradio', { name: 'Júnior' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(submenu);
      expect(getComputedStyle(submenu).boxShadow, theme).not.toBe('none');
      expect(getComputedStyle(submenu).borderTopLeftRadius).toBe('6px');
      const ring = focusRing(active);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(submenu), theme).toEqual([]);
    }
  });
});
