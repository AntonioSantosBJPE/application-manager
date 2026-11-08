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

  it('does not point at a hint that is not rendered', () => {
    render(
      <Field.Root>
        <Field.Label htmlFor="email-only">E-mail</Field.Label>
        <Field.Control id="email-only" name="email" />
      </Field.Root>,
    );

    const control = screen.getByLabelText('E-mail');

    expect(control).not.toHaveAttribute('aria-describedby');
    expect(control).not.toHaveAttribute('aria-invalid');
  });

  it('does not point at an error that is not rendered, even when the field is invalid', () => {
    render(
      <Field.Root invalid>
        <Field.Label htmlFor="invalid-only">E-mail</Field.Label>
        <Field.Control id="invalid-only" name="email" />
      </Field.Root>,
    );

    const control = screen.getByLabelText('E-mail');

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).not.toHaveAttribute('aria-describedby');
  });

  it('describes the control with the hint and the error, in that order', () => {
    render(<EmailField invalid />);

    const control = screen.getByLabelText('E-mail');
    const hint = screen.getByText('Use o e-mail do convite.');
    const error = screen.getByText('E-mail inválido.');
    const describedBy = control.getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(describedBy).toEqual([hint.id, error.id]);
    for (const id of describedBy) expect(document.getElementById(id)).not.toBeNull();
  });

  it('drops the error from the description when the field becomes valid again', () => {
    const { rerender } = render(<EmailField invalid />);

    rerender(<EmailField />);

    const control = screen.getByLabelText('E-mail');
    const hint = screen.getByText('Use o e-mail do convite.');

    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).toHaveAttribute('aria-describedby', hint.id);
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

function NotesField({ invalid = false }: { invalid?: boolean }) {
  return (
    <Field.Root invalid={invalid}>
      <Field.Label htmlFor="notes">Notas</Field.Label>
      <Field.Textarea id="notes" name="notes" />
      <Field.Hint>Até 2000 caracteres.</Field.Hint>
      <Field.Error>As notas passam de 2000 caracteres.</Field.Error>
    </Field.Root>
  );
}

describe('Field in the Prumo', () => {
  it('PRU-02 AC09 wires Field.Textarea like the control: label, hint, error and aria-invalid', () => {
    const { rerender } = render(<NotesField />);

    const notes = screen.getByLabelText('Notas');
    const hint = screen.getByText('Até 2000 caracteres.');
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes).toHaveAttribute('name', 'notes');
    expect(notes).toHaveAttribute('aria-describedby', hint.id);
    expect(notes).not.toHaveAttribute('aria-invalid');
    expect(notes).toHaveClass('min-h-22', 'border-border-control');

    rerender(<NotesField invalid />);

    const error = screen.getByText('As notas passam de 2000 caracteres.');
    expect(screen.getByLabelText('Notas')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Notas')).toHaveAttribute(
      'aria-describedby',
      `${hint.id} ${error.id}`,
    );
    expect(screen.getByLabelText('Notas')).toHaveClass('border-danger');
  });

  it('PRU-02 AC09 keeps what the person types in Field.Textarea', () => {
    render(<NotesField />);

    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Retornar na sexta.' } });

    expect(screen.getByLabelText('Notas')).toHaveValue('Retornar na sexta.');
  });

  it('PRU-02 AC10 draws the invalid control in danger and the error with the circle-alert icon', () => {
    const { rerender } = render(<EmailField />);

    expect(screen.getByLabelText('E-mail')).toHaveClass('border-border-control');
    expect(screen.getByLabelText('E-mail')).not.toHaveClass('border-danger');

    rerender(<EmailField invalid />);

    const control = screen.getByLabelText('E-mail');
    const error = screen.getByText('E-mail inválido.');
    expect(control).toHaveClass('border-danger');
    expect(control).not.toHaveClass('border-border-control');
    expect(error).toHaveClass('text-danger');
    expect(error.querySelector('svg')).toHaveClass('lucide-circle-alert');
    expect(error.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(error.textContent).toBe('E-mail inválido.');
  });

  it('PRU-02 AC11 renders a read-only control on surface-raised with text-muted', () => {
    render(
      <Field.Root>
        <Field.Label htmlFor="invite-email">E-mail</Field.Label>
        <Field.Control id="invite-email" type="email" readOnly value="ana@exemplo.com" />
      </Field.Root>,
    );

    const control = screen.getByLabelText('E-mail');
    expect(control).toHaveAttribute('readonly');
    expect(control).toHaveValue('ana@exemplo.com');
    expect(control).toHaveClass('bg-surface-raised', 'text-text-muted');
    expect(control).not.toHaveClass('bg-surface', 'text-text');
  });
});
