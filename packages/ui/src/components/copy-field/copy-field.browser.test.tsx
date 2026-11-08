import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { CopyField, type CopyFieldStatus } from './copy-field';

const invitationUrl = 'https://app.exemplo.com/invite/abc123';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderField(status: CopyFieldStatus = 'idle') {
  render(
    <div style={{ width: 420 }}>
      <CopyField
        value={invitationUrl}
        onCopy={() => {}}
        status={status}
        copyLabel="Copiar"
        copiedLabel="Copiado"
        failureMessage="Não foi possível copiar. Selecione o link."
        valueLabel="Link do convite"
      />
    </div>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('CopyField in the browser', () => {
  it('PRU-02 AC13 paints the value in Geist Mono on surface-raised and selects it all on focus', async () => {
    renderField();
    const value = screen.getByLabelText<HTMLTextAreaElement>('Link do convite');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(value);
      expect(getComputedStyle(value).backgroundColor, theme).toBe(tokenColor('surface-raised'));
    }
    expect(getComputedStyle(value).fontFamily).toMatch(/^"Geist Mono Variable"/);

    await userEvent.tab();

    expect(document.activeElement).toBe(value);
    expect(value.value.slice(value.selectionStart, value.selectionEnd)).toBe(invitationUrl);
  });

  it('PRU-02 AC14 draws the 14px check icon beside copiedLabel', () => {
    renderField('copied');

    const button = screen.getByRole('button', { name: 'Copiado' });
    const icon = button.querySelector('svg')!;
    expect(icon.getBoundingClientRect().width).toBe(14);
    expect(getComputedStyle(icon).color).toBe(getComputedStyle(button).color);
  });

  it('PRU-02 AC15 places the danger Alert below the field and keeps the value selectable', async () => {
    renderField('failed');

    const value = screen.getByLabelText<HTMLTextAreaElement>('Link do convite');
    const alert = screen.getByRole('alert');
    expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      value.getBoundingClientRect().bottom,
    );
    expect(getComputedStyle(alert).backgroundColor).toBe(tokenColor('danger-subtle'));
    expect(getComputedStyle(value).userSelect).not.toBe('none');

    await userEvent.tab();

    expect(document.activeElement).toBe(value);
    expect([value.selectionStart, value.selectionEnd]).toEqual([0, invitationUrl.length]);
  });
});
