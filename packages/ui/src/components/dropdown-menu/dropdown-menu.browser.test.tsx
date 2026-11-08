import { render, screen } from '@testing-library/react';
import { Ellipsis } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderMenu() {
  render(
    <div className="bg-surface p-12">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button intent="ghost" size="sm" icon={Ellipsis} aria-label="Ações de Skill Fictícia Alfa" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Editar</DropdownMenu.Item>
          <DropdownMenu.Item>Apelidos</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>,
  );
  return screen.getByRole('button', { name: 'Ações de Skill Fictícia Alfa' });
}

describe('DropdownMenu in the browser', () => {
  it('opens with a real Enter, moves with the arrows, closes on Esc and gives the focus back', async () => {
    const trigger = renderMenu();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Apelidos' }));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('paints the overlay surface, border-strong, radius-md and shadow, and highlights the active item with surface-hover', async () => {
    await page.viewport(1280, 800);
    const trigger = renderMenu();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu');
    const item = screen.getByRole('menuitem', { name: 'Editar' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(menu);
      const style = getComputedStyle(menu);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-overlay'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.borderTopLeftRadius).toBe('6px');
      expect(style.boxShadow).not.toBe('none');
      expect(menu.getBoundingClientRect().width).toBeGreaterThanOrEqual(200);
      expect(item.getBoundingClientRect().height).toBe(30);
      expect(getComputedStyle(item).backgroundColor, theme).toBe(tokenColor('surface-hover'));
      const ring = focusRing(item);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
    }
  });

  // The scan covers the menu itself. While a Radix modal menu is open it hides the rest of the page
  // with `aria-hidden`, trigger included, and axe flags that container as hidden-but-focusable.
  it('has no axe violation in the open menu, in both themes', async () => {
    const trigger = renderMenu();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(menu);
      expect(await axeViolations(menu), theme).toEqual([]);
    }
  });
});
