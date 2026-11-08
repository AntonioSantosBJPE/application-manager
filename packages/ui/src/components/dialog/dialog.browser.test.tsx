import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { Field } from '../field';
import { Dialog } from './dialog';

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

function renderDialog() {
  render(
    <div>
      <button type="button">Antes</button>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button intent="secondary">Editar</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Editar skill</Dialog.Title>
          <Dialog.Description>Corrija o nome ou a categoria.</Dialog.Description>
          <Field.Root>
            <Field.Label htmlFor="nome">Nome</Field.Label>
            <Field.Control id="nome" defaultValue="Skill Fictícia Alfa" />
          </Field.Root>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button intent="secondary">Cancelar</Button>
            </Dialog.Close>
            <Button intent="primary">Salvar</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <button type="button">Depois</button>
    </div>,
  );
  return screen.getByRole('button', { name: 'Editar' });
}

describe('Dialog in the browser', () => {
  it('moves the focus in, keeps Tab and Shift+Tab inside, closes on a real Esc and gives the focus back', async () => {
    const trigger = renderDialog();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Editar skill' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement), `Tab ${step + 1}`).toBe(true);
    }
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `Shift+Tab ${step + 1}`).toBe(true);
    }

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('paints surface-overlay, border-strong, radius-lg, shadow-overlay, 440px and the backdrop in both themes', async () => {
    await page.viewport(1280, 800);
    await userEvent.click(renderDialog());
    const dialog = screen.getByRole('dialog');
    const veil = dialog.previousElementSibling!;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      const style = getComputedStyle(dialog);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-overlay'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.borderTopLeftRadius).toBe('8px');
      expect(style.boxShadow).not.toBe('none');
      expect(dialog.getBoundingClientRect().width).toBe(440);
      expect(getComputedStyle(veil).position).toBe('fixed');
    }
  });

  it('stays inside a 375px viewport', async () => {
    await page.viewport(375, 700);
    await userEvent.click(renderDialog());

    const bounds = screen.getByRole('dialog').getBoundingClientRect();

    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('has no axe violation while open, in both themes', async () => {
    await userEvent.click(renderDialog());
    const dialog = screen.getByRole('dialog');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      expect(await axeViolations(dialog), theme).toEqual([]);
    }
  });
});
