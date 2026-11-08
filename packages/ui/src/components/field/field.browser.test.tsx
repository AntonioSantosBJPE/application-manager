import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { contrastRatio, settle } from '../../testing/contrast';
import { Field } from './field';

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

const themes = ['light', 'dark'] as const;

describe('Field in the browser', () => {
  it('PRU-01 AC13 draws the keyboard focus of Field.Control and Field.Textarea 2px solid offset -1px, with the border in focus', async () => {
    for (const theme of themes) {
      document.documentElement.setAttribute('data-theme', theme);
      const { unmount } = render(
        <div style={{ width: 320 }}>
          <Field.Root>
            <Field.Label htmlFor="company">Empresa</Field.Label>
            <Field.Control id="company" />
          </Field.Root>
          <Field.Root>
            <Field.Label htmlFor="notes">Notas</Field.Label>
            <Field.Textarea id="notes" />
          </Field.Root>
        </div>,
      );

      for (const label of ['Empresa', 'Notas']) {
        const control = screen.getByLabelText(label);
        await userEvent.tab();
        expect(control, `${label} ${theme}`).toBe(document.activeElement);
        await settle(control);

        const style = getComputedStyle(control);
        const focus = tokenColor('focus');
        expect(style.outlineStyle, `${label} ${theme}`).toBe('solid');
        expect(style.outlineWidth, `${label} ${theme}`).toBe('2px');
        expect(style.outlineOffset, `${label} ${theme}`).toBe('-1px');
        expect(style.outlineColor, `${label} ${theme}`).toBe(focus);
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          expect(style[`border${side}Color`], `${label} ${side} ${theme}`).toBe(focus);
        }
      }
      unmount();
    }
  });

  it('PRU-02 AC09 draws Field.Textarea at least 88px tall with the border of the control', async () => {
    render(
      <div style={{ width: 320 }}>
        <Field.Root>
          <Field.Label htmlFor="notes">Notas</Field.Label>
          <Field.Textarea id="notes" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="company">Empresa</Field.Label>
          <Field.Control id="company" />
        </Field.Root>
      </div>,
    );

    const notes = screen.getByLabelText('Notas');
    const company = screen.getByLabelText('Empresa');
    // The border at rest: a pointer left over a control by an earlier test would show the hover border.
    await userEvent.unhover(notes);
    await userEvent.unhover(company);
    await settle(notes);
    expect(notes.getBoundingClientRect().height).toBeGreaterThanOrEqual(88);
    expect(company.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(notes).borderTopColor).toBe(tokenColor('border-control'));
    expect(getComputedStyle(notes).borderTopColor).toBe(getComputedStyle(company).borderTopColor);
    expect(getComputedStyle(notes).borderTopWidth).toBe('1px');
  });

  it('PRU-02 AC10 paints the invalid border and the error in danger, with a 14px icon', async () => {
    render(
      <Field.Root invalid>
        <Field.Label htmlFor="password">Senha</Field.Label>
        <Field.Control id="password" type="password" />
        <Field.Error>A senha precisa ter de 12 a 128 caracteres.</Field.Error>
      </Field.Root>,
    );

    for (const theme of themes) {
      document.documentElement.setAttribute('data-theme', theme);
      const control = screen.getByLabelText('Senha');
      const error = screen.getByText('A senha precisa ter de 12 a 128 caracteres.');
      await settle(control);
      expect(getComputedStyle(control).borderTopColor, theme).toBe(tokenColor('danger'));
      expect(getComputedStyle(error).color, theme).toBe(tokenColor('danger'));
      const icon = error.querySelector('svg')!;
      expect(icon.getBoundingClientRect().width).toBe(14);
      expect(getComputedStyle(icon).color, theme).toBe(tokenColor('danger'));
    }
  });

  it('PRU-02 AC11 fills a read-only control with surface-raised and text-muted, legible in both themes', async () => {
    render(
      <Field.Root>
        <Field.Label htmlFor="invite-email">E-mail</Field.Label>
        <Field.Control id="invite-email" readOnly value="ana@exemplo.com" />
      </Field.Root>,
    );

    for (const theme of themes) {
      document.documentElement.setAttribute('data-theme', theme);
      const control = screen.getByLabelText('E-mail');
      await settle(control);
      const style = getComputedStyle(control);
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-raised'));
      expect(style.color, theme).toBe(tokenColor('text-muted'));
      expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
