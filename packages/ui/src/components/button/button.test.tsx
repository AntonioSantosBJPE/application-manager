import { fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders the primary intent with the accent token classes', () => {
    render(<Button>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveClass('bg-accent', 'text-on-accent', 'border-accent');
  });

  it('renders the secondary intent with surface classes and no accent fill', () => {
    render(<Button intent="secondary">Cancelar</Button>);

    const button = screen.getByRole('button', { name: 'Cancelar' });
    expect(button).toHaveClass('bg-surface-raised', 'text-text', 'border-border');
    expect(button).not.toHaveClass('bg-accent');
  });

  it('renders the danger intent with the danger token classes', () => {
    render(<Button intent="danger">Revogar</Button>);

    const button = screen.getByRole('button', { name: 'Revogar' });
    expect(button).toHaveClass('bg-danger', 'border-danger', 'text-on-accent');
    expect(button).not.toHaveClass('bg-accent');
  });

  it('runs the action when the button is clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Copiar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not run the action when the button is disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Entrar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Entrar' });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit a form by default, so a copy action inside one stays inert', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Copiar</Button>
      </form>,
    );

    const button = screen.getByRole('button', { name: 'Copiar' });
    expect(button).toHaveAttribute('type', 'button');

    fireEvent.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the form when the caller asks for type submit', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Entrar</Button>
      </form>,
    );

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveAttribute('type', 'submit');

    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not add a type to the child element when asChild is set', () => {
    render(
      <Button asChild intent="secondary">
        <a href="/status">Status</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Status' })).not.toHaveAttribute('type');
  });

  it('renders the child element with the button classes when asChild is set', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button asChild intent="secondary" onClick={onClick}>
        <a href="/admin/invitations" onClick={(event) => event.preventDefault()}>
          Convites
        </a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Convites' });
    expect(link).toHaveAttribute('href', '/admin/invitations');
    expect(link).toHaveClass('bg-surface-raised', 'text-text');
    expect(container.querySelector('button')).toBeNull();

    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
