import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { ContextMenu } from './context-menu';

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

function renderRow() {
  render(
    <div className="bg-surface p-12">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div tabIndex={0} data-testid="row" className="h-10 w-80 border border-border px-2">
            Empresa Fictícia Alfa
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item>Abrir</ContextMenu.Item>
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>Status</ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <ContextMenu.RadioGroup value="applied">
                <ContextMenu.RadioItem value="saved">Salva</ContextMenu.RadioItem>
                <ContextMenu.RadioItem value="applied">Enviada</ContextMenu.RadioItem>
              </ContextMenu.RadioGroup>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>,
  );
  return screen.getByTestId('row');
}

describe('ContextMenu in the browser', () => {
  it('APP-50 opens with a real Shift+F10 on the focused row, moves with the arrows and gives the focus back on Esc', async () => {
    const row = renderRow();
    await userEvent.tab();
    expect(document.activeElement).toBe(row);

    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    expect(screen.getByRole('menu')).toBeTruthy();
    // Opened from the keyboard, the menu puts the focus on its first item.
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Abrir' }));

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Status' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitemradio', { name: 'Enviada' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Status' }));

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('APP-50 opens with a real right click on the row', async () => {
    renderRow();

    await userEvent.click(screen.getByTestId('row'), { button: 'right' });

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Abrir', 'Status']);
  });

  it('APP-50 paints the overlay surface like the DropdownMenu, in both themes, without axe violations', async () => {
    await page.viewport(1280, 800);
    renderRow().focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const menu = screen.getByRole('menu');
    const item = screen.getByRole('menuitem', { name: 'Abrir' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(menu);
      const style = getComputedStyle(menu);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-overlay'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.borderTopLeftRadius).toBe('6px');
      expect(style.boxShadow).not.toBe('none');
      expect(item.getBoundingClientRect().height).toBe(30);
      const ring = focusRing(item);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(menu), theme).toEqual([]);
    }
  });
});
