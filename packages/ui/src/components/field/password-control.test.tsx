import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './field';

const labels = { toggleLabel: 'Mostrar senha' };

function PasswordField({
  invalid = false,
  disabled = false,
  onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
}: {
  invalid?: boolean;
  disabled?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Field.Root invalid={invalid}>
        <Field.Label htmlFor="password">Senha</Field.Label>
        <Field.PasswordControl
          id="password"
          name="password"
          autoComplete="current-password"
          disabled={disabled}
          {...labels}
        />
        <Field.Hint>Use de 12 a 128 caracteres.</Field.Hint>
        <Field.Error>A senha precisa ter de 12 a 128 caracteres.</Field.Error>
      </Field.Root>
      <button type="submit">Entrar</button>
    </form>
  );
}

describe('Field.PasswordControl', () => {
  it('PRU-03 AC01 renders the password control and a toggle at its right end, inside the field', () => {
    render(<PasswordField />);

    const control = screen.getByLabelText('Senha');
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(control.tagName).toBe('INPUT');
    expect(control).toHaveAttribute('name', 'password');
    // The toggle sits after the control, in the same wrapper, so it draws at its right end.
    expect(control.parentElement).toContainElement(toggle);
    expect(control.nextElementSibling).toBe(toggle);
    expect(toggle).toHaveClass('absolute', 'right-0.5');
  });

  it('PRU-03 AC02 starts with the password hidden', () => {
    render(<PasswordField />);

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('PRU-03 AC03 switches between password and text on each click and keeps the typed value', async () => {
    const user = userEvent.setup();
    render(<PasswordField />);
    const control = screen.getByLabelText('Senha');
    await user.type(control, 'correct-horse-battery');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Senha')).toBe(control);
    expect(control).toHaveAttribute('type', 'text');
    expect(control).toHaveValue('correct-horse-battery');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha', pressed: true }));

    expect(control).toHaveAttribute('type', 'password');
    expect(control).toHaveValue('correct-horse-battery');
  });

  it('PRU-03 AC04 makes the toggle a type button with aria-pressed and the label from the caller', async () => {
    const user = userEvent.setup();
    render(<PasswordField />);

    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.querySelector('svg')).toHaveClass('lucide-eye');

    await user.click(toggle);

    // The label stays the same in both states; aria-pressed carries the state (PRU-03 AC4).
    expect(toggle).toHaveAccessibleName('Mostrar senha');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle.querySelector('svg')).toHaveClass('lucide-eye-off');
  });

  it('PRU-03 AC05 never submits the form from the toggle nor sends it as a field', async () => {
    const user = userEvent.setup();
    const sent: [string, FormDataEntryValue][][] = [];
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      sent.push([...new FormData(event.currentTarget).entries()]);
    });
    render(<PasswordField onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Senha'), 'correct-horse-battery');

    // Activating the toggle, by click and by Enter on the focused toggle, does not submit.
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    // Submitting with the toggle focused and the password visible...
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    const toggle = screen.getByRole('button', { name: 'Mostrar senha', pressed: true });
    expect(toggle).toHaveFocus();
    (toggle as HTMLButtonElement).form?.requestSubmit();
    // ...and from the control, with Enter, the toggle not focused.
    await user.type(screen.getByLabelText('Senha'), '{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(2);
    for (const entries of sent) expect(entries).toEqual([['password', 'correct-horse-battery']]);
  });

  it('PRU-03 AC06 keeps autoComplete, aria-describedby and aria-invalid while the password is visible', async () => {
    const user = userEvent.setup();
    render(<PasswordField invalid />);
    const control = screen.getByLabelText('Senha');
    const hint = screen.getByText('Use de 12 a 128 caracteres.');
    const error = screen.getByText('A senha precisa ter de 12 a 128 caracteres.');
    const hidden = {
      autoComplete: control.getAttribute('autocomplete'),
      describedBy: control.getAttribute('aria-describedby'),
      invalid: control.getAttribute('aria-invalid'),
    };
    expect(hidden).toEqual({
      autoComplete: 'current-password',
      describedBy: `${hint.id} ${error.id}`,
      invalid: 'true',
    });

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(control).toHaveAttribute('type', 'text');
    expect({
      autoComplete: control.getAttribute('autocomplete'),
      describedBy: control.getAttribute('aria-describedby'),
      invalid: control.getAttribute('aria-invalid'),
    }).toEqual(hidden);
    expect(control).toHaveClass('border-danger');
  });

  it('PRU-03 AC07 disables the toggle together with the field', async () => {
    const user = userEvent.setup();
    render(<PasswordField disabled />);

    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(screen.getByLabelText('Senha')).toBeDisabled();
    expect(toggle).toBeDisabled();

    await user.click(toggle);

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('PRU-03 AC10 reaches the toggle with Tab right after the control and operates it with Enter and Space', async () => {
    const user = userEvent.setup();
    render(<PasswordField />);
    const control = screen.getByLabelText('Senha');

    await user.tab();
    expect(control).toHaveFocus();
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveFocus();

    await user.keyboard(' ');
    expect(control).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus();
  });

  it('PRU-03 AC04 hands the input to a ref from the caller', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(
      <Field.Root>
        <Field.PasswordControl aria-label="Senha" ref={ref} {...labels} />
      </Field.Root>,
    );

    expect(ref.current).toBe(screen.getByLabelText('Senha'));
  });
});
