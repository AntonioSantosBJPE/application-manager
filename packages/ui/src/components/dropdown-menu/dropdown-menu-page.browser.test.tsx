import { render, screen } from '@testing-library/react';
import { Ellipsis } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { DropdownMenu } from './dropdown-menu';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderPage() {
  render(
    <div className="bg-surface p-12" data-testid="page">
      <main>
        <Button intent="secondary">Fora do menu</Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button intent="ghost" size="sm" icon={Ellipsis} aria-label="Ações de Skill Fictícia Alfa" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Editar</DropdownMenu.Item>
            <DropdownMenu.Item>Apelidos</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </main>
    </div>,
  );
  return screen.getByRole('button', { name: 'Ações de Skill Fictícia Alfa' });
}

describe('DropdownMenu inside a page with other focusable content', () => {
  it('hides no ancestor of the trigger and passes axe on the whole page in both themes while open', async () => {
    const trigger = renderPage();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu');

    for (let node: Element | null = trigger; node !== null; node = node.parentElement) {
      expect(node.getAttribute('aria-hidden'), node.tagName).toBeNull();
    }
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(menu);
      expect(await axeViolations(document.body), theme).toEqual([]);
    }
  });

  it('still opens with Enter, moves with the arrows, closes on Esc and returns the focus', async () => {
    const trigger = renderPage();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Apelidos' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
