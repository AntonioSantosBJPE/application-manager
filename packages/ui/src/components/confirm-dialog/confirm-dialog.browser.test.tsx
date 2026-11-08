import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
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

/** A background color as the browser resolves it (keeps the alpha of the backdrop). */
function tokenBackground(token: string): string {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return resolved;
}

/** The overlay shadow of the active theme as the browser resolves it. */
function overlayShadow(): string {
  const probe = document.createElement('span');
  probe.style.boxShadow = 'var(--shadow-overlay)';
  document.body.append(probe);
  const resolved = getComputedStyle(probe).boxShadow;
  probe.remove();
  return resolved;
}

function renderDialog(onConfirm = vi.fn()) {
  render(
    <div>
      <button type="button">Antes</button>
      <ConfirmDialog
        trigger={<Button intent="secondary">Revogar</Button>}
        title="Revogar convite"
        description="ana@exemplo.com não poderá mais usar este link."
        confirmLabel="Revogar convite"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
      />
      <button type="button">Depois</button>
    </div>,
  );
  return { onConfirm, trigger: screen.getByRole('button', { name: 'Revogar' }) };
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('ConfirmDialog in the browser', () => {
  it('PRU-02 AC16 paints surface-overlay, border-strong, radius-lg, shadow-overlay, 440px and the backdrop', async () => {
    await page.viewport(1280, 800);
    const { trigger } = renderDialog();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog');
    // The veil is the element Radix renders right before the dialog in the portal.
    const veil = dialog.previousElementSibling!;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      const style = getComputedStyle(dialog);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-overlay'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopLeftRadius).toBe('8px');
      expect(style.boxShadow, theme).toBe(overlayShadow());
      expect(style.boxShadow).not.toBe('none');
      expect(dialog.getBoundingClientRect().width).toBe(440);
      expect(getComputedStyle(veil).backgroundColor, theme).toBe(tokenBackground('backdrop'));
      const cover = veil.getBoundingClientRect();
      expect([cover.left, cover.top, cover.width, cover.height]).toEqual([
        0,
        0,
        window.innerWidth,
        window.innerHeight,
      ]);
    }
  });

  it('PRU-02 AC17 closes on a real Esc press without confirming and gives the focus back', async () => {
    const { onConfirm, trigger } = renderDialog();
    await userEvent.click(trigger);
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    await userEvent.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('PRU-02 AC18 never lets Tab leave the open dialog', async () => {
    const { trigger } = renderDialog();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog');

    for (let step = 0; step < 5; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement), `Tab ${step + 1}`).toBe(true);
    }
    for (let step = 0; step < 5; step += 1) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `Shift+Tab ${step + 1}`).toBe(true);
    }
  });
});
