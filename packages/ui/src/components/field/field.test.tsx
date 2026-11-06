import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';

function EmailField({ invalid = false }: { invalid?: boolean }) {
  return (
    <Field.Root invalid={invalid}>
      <Field.Label htmlFor="email">E-mail</Field.Label>
      <Field.Control id="email" name="email" type="email" />
      <Field.Hint>Use o e-mail do convite.</Field.Hint>
      <Field.Error>E-mail inválido.</Field.Error>
    </Field.Root>
  );
}

describe('Field', () => {
  it('describes the control with the hint and leaves it valid', () => {
    render(<EmailField />);

    const control = screen.getByLabelText('E-mail');
    const hint = screen.getByText('Use o e-mail do convite.');

    expect(control).toHaveAttribute('aria-describedby', hint.id);
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('E-mail inválido.')).toBeNull();
  });

  it('marks the control invalid and describes it with hint and error', () => {
    render(<EmailField invalid />);

    const control = screen.getByLabelText('E-mail');
    const hint = screen.getByText('Use o e-mail do convite.');
    const error = screen.getByText('E-mail inválido.');

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control.getAttribute('aria-describedby')?.split(' ')).toEqual([hint.id, error.id]);
    expect(error.id).not.toBe(hint.id);
  });

  it('keeps what the user types and shows the error after the submit', () => {
    const { rerender } = render(<EmailField />);

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } });

    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
    expect(screen.queryByText('E-mail inválido.')).toBeNull();

    rerender(<EmailField invalid />);

    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument();
  });

  it('uses the danger token for the invalid border and the error text', () => {
    render(<EmailField invalid />);

    expect(screen.getByLabelText('E-mail')).toHaveClass('border-danger');
    expect(screen.getByText('E-mail inválido.')).toHaveClass('text-danger');
  });
});
