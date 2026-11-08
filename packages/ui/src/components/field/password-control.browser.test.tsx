import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { focusRing, settle } from '../../testing/contrast';
import { Field } from './field';

function PasswordField() {
  return (
    <Field.Root className="w-80">
      <Field.Label htmlFor="password">Senha</Field.Label>
      <Field.PasswordControl
        id="password"
        name="password"
        autoComplete="current-password"
        toggleLabel="Mostrar senha"
      />
    </Field.Root>
  );
}

describe('Field.PasswordControl in the browser', () => {
  it('PRU-03 AC01 draws the toggle inside the right end of the control', () => {
    render(<PasswordField />);

    const control = screen.getByLabelText('Senha').getBoundingClientRect();
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' }).getBoundingClientRect();

    expect(toggle.right).toBeLessThanOrEqual(control.right);
    expect(control.right - toggle.right).toBeLessThanOrEqual(4);
    expect(toggle.top).toBeGreaterThanOrEqual(control.top);
    expect(toggle.bottom).toBeLessThanOrEqual(control.bottom);
  });

  it('PRU-03 AC03 keeps the caret where the person left it when the toggle is clicked', async () => {
    render(<PasswordField />);
    const control = screen.getByLabelText<HTMLInputElement>('Senha');
    await userEvent.type(control, 'correct-horse-battery');
    control.setSelectionRange(7, 7);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(control.type).toBe('text');
    expect(control.value).toBe('correct-horse-battery');
    expect([control.selectionStart, control.selectionEnd]).toEqual([7, 7]);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha', pressed: true }));

    expect(control.type).toBe('password');
    expect([control.selectionStart, control.selectionEnd]).toEqual([7, 7]);
  });

  it('PRU-03 AC10 reaches the toggle by Tab after the control, operates it by key and rings it at 2px', async () => {
    render(<PasswordField />);
    const control = screen.getByLabelText<HTMLInputElement>('Senha');

    await userEvent.tab();
    expect(document.activeElement).toBe(control);
    await userEvent.tab();
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(document.activeElement).toBe(toggle);
    await settle(toggle);

    const ring = focusRing(toggle);
    expect(ring.drawn).toBe(true);
    expect(ring.isFocusToken).toBe(true);
    expect(getComputedStyle(toggle).outlineWidth).toBe('2px');

    await userEvent.keyboard('{Enter}');
    expect(control.type).toBe('text');
    await userEvent.keyboard(' ');
    expect(control.type).toBe('password');
    expect(document.activeElement).toBe(toggle);
  });
});
