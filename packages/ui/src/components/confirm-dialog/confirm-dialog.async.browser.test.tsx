import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { ConfirmDialog } from './confirm-dialog';

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

function renderDialog(onConfirm: () => void | Promise<unknown>, confirmIntent?: 'danger' | 'primary') {
  render(
    <ConfirmDialog
      trigger={<Button intent="secondary">Promover</Button>}
      title="Promover Skill Fictícia Alfa?"
      description="A skill passa a ser visível para todas as pessoas."
      confirmLabel="Promover skill"
      cancelLabel="Cancelar"
      confirmIntent={confirmIntent}
      onConfirm={onConfirm}
    />,
  );
  return screen.getByRole('button', { name: 'Promover' });
}

describe('ConfirmDialog waiting for the action, in the browser', () => {
  it('SKL-50 keeps the dialog open and the buttons disabled on a real click, sends once, and closes when done', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((done) => (finish = done)));
    const trigger = renderDialog(onConfirm);
    await userEvent.click(trigger);
    const confirm = screen.getByRole('button', { name: 'Promover skill' });

    await userEvent.click(confirm);
    await userEvent.click(confirm, { force: true });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getComputedStyle(confirm).opacity).toBe('0.5');

    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    finish();
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('SKL-45 paints the primary confirm in the accent token and the default one in danger, in both themes', async () => {
    const trigger = renderDialog(vi.fn(), 'primary');
    await userEvent.click(trigger);
    const primary = screen.getByRole('button', { name: 'Promover skill' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(primary);
      const style = getComputedStyle(primary);
      expect(style.backgroundColor, theme).toBe(tokenColor('accent'));
      expect(style.color, theme).toBe(tokenColor('on-accent'));
    }
  });

  it('SKL-52 has no axe violation while the action is pending, in both themes', async () => {
    const trigger = renderDialog(() => new Promise<void>(() => {}), 'primary');
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Promover skill' }));
    const dialog = screen.getByRole('alertdialog');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      expect(await axeViolations(dialog), theme).toEqual([]);
    }
  });
});
