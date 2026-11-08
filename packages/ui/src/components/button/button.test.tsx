import { fireEvent, render, screen } from '@testing-library/react';
import { ArrowRight, LogOut, UserPlus } from 'lucide-react';
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

  it('renders the link intent as accent text with no box and no side padding', () => {
    render(
      <>
        <Button intent="link">Ver texto completo</Button>
        <Button intent="link" size="sm">
          Ver menos
        </Button>
        <Button intent="ghost" size="sm">
          Cancelar
        </Button>
      </>,
    );

    for (const name of ['Ver texto completo', 'Ver menos']) {
      const link = screen.getByRole('button', { name });
      expect(link).toHaveClass('text-accent-text', 'bg-transparent', 'border-transparent', 'px-0');
      expect(link).not.toHaveClass('px-2', 'px-3', 'text-text-muted', 'bg-accent');
    }
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('px-2');
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

describe('Button in the Prumo', () => {
  it('PRU-02 AC01 accepts primary, secondary, ghost and danger, with primary by default', () => {
    render(
      <>
        <Button>Padrão</Button>
        <Button intent="primary">Primário</Button>
        <Button intent="secondary">Secundário</Button>
        <Button intent="ghost">Fantasma</Button>
        <Button intent="danger">Perigo</Button>
      </>,
    );

    const byName = (name: string) => screen.getByRole('button', { name });
    expect(byName('Padrão').className).toBe(byName('Primário').className);
    expect(byName('Primário')).toHaveClass('bg-accent', 'text-on-accent');
    expect(byName('Secundário')).toHaveClass('bg-surface-raised', 'text-text');
    expect(byName('Fantasma')).toHaveClass('bg-transparent', 'border-transparent', 'text-text-muted');
    expect(byName('Fantasma')).not.toHaveClass('bg-accent', 'bg-surface-raised', 'bg-danger');
    expect(byName('Perigo')).toHaveClass('bg-danger', 'text-on-accent');
  });

  it('PRU-02 AC02 uses the control-md height by default and control-sm with size sm', () => {
    render(
      <>
        <Button>Entrar</Button>
        <Button size="sm">Revogar</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('h-control-md');
    expect(screen.getByRole('button', { name: 'Revogar' })).toHaveClass('h-control-sm');
  });

  it('PRU-02 AC03 fades a disabled button to 50% and ignores the click', () => {
    const onClick = vi.fn();
    render(
      <Button intent="ghost" onClick={onClick} disabled>
        Revogar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Revogar' });
    fireEvent.click(button);

    expect(button).toHaveClass('disabled:opacity-50');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('PRU-02 AC04 writes the label in on-accent for primary and danger only', () => {
    render(
      <>
        <Button intent="primary">Entrar</Button>
        <Button intent="danger">Revogar</Button>
        <Button intent="secondary">Cancelar</Button>
        <Button intent="ghost">Ver convites</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('text-on-accent');
    expect(screen.getByRole('button', { name: 'Revogar' })).toHaveClass('text-on-accent');
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toHaveClass('text-on-accent');
    expect(screen.getByRole('button', { name: 'Ver convites' })).not.toHaveClass('text-on-accent');
  });

  it('PRU-02 AC05 renders the child with the button classes and attributes when asChild is set', () => {
    const { container } = render(
      <Button asChild intent="ghost" size="sm" aria-describedby="nota" data-row="1">
        <a href="/admin/invitations">Ver convites</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Ver convites' });
    expect(link).toHaveAttribute('href', '/admin/invitations');
    expect(link).toHaveAttribute('aria-describedby', 'nota');
    expect(link).toHaveAttribute('data-row', '1');
    expect(link).toHaveClass('h-control-sm', 'bg-transparent', 'text-text-muted', 'rounded-sm');
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('Button with an icon', () => {
  it('PRU-01 AC11 draws the icon before the label, 16px by default and 14px with sm, stroke 1.75 and hidden', () => {
    render(
      <>
        <Button intent="ghost" icon={LogOut}>
          Sair
        </Button>
        <Button intent="secondary" size="sm" icon={UserPlus}>
          Convidar pessoa
        </Button>
      </>,
    );

    for (const [name, size, glyph] of [
      ['Sair', '16', 'lucide-log-out'],
      ['Convidar pessoa', '14', 'lucide-user-plus'],
    ] as const) {
      const button = screen.getByRole('button', { name });
      const icon = button.firstElementChild!;
      expect(icon.tagName.toLowerCase(), name).toBe('svg');
      expect(icon, name).toHaveClass(glyph);
      expect(icon, name).toHaveAttribute('width', size);
      expect(icon, name).toHaveAttribute('stroke-width', '1.75');
      expect(icon, name).toHaveAttribute('aria-hidden', 'true');
      expect(button.querySelectorAll('svg'), name).toHaveLength(1);
      expect(button.textContent, name).toBe(name);
    }
  });

  it('PRU-01 AC11 draws iconEnd after the label', () => {
    render(
      <Button intent="ghost" size="sm" iconEnd={ArrowRight}>
        Ver convites
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Ver convites' });
    expect(button.lastElementChild).toHaveClass('lucide-arrow-right');
    expect(button.lastElementChild).toHaveAttribute('width', '14');
    expect(button.firstChild?.textContent).toBe('Ver convites');
  });

  it('PRU-02 AC05 keeps the icon around the child when asChild is set', () => {
    const { container } = render(
      <Button asChild intent="secondary" size="sm" icon={UserPlus}>
        <a href="/admin/invitations">Convidar pessoa</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Convidar pessoa' });
    expect(link).toHaveClass('bg-surface-raised', 'h-control-sm', 'px-2');
    expect(link.firstElementChild).toHaveClass('lucide-user-plus');
    expect(link.textContent).toBe('Convidar pessoa');
    expect(container.querySelector('button')).toBeNull();
  });

  it('PRU-01 AC11 names a button with only an icon by its aria-label and draws it square', () => {
    render(<Button intent="ghost" size="sm" icon={LogOut} aria-label="Sair" />);

    const button = screen.getByRole('button', { name: 'Sair' });
    expect(button.textContent).toBe('');
    expect(button).toHaveClass('w-control-sm', 'h-control-sm');
    expect(button).not.toHaveClass('px-2');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('PRU-01 AC11 refuses a button with only an icon and no aria-label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Button intent="ghost" icon={LogOut} />)).toThrow(/aria-label/);
    quiet.mockRestore();
  });

  it('draws no icon when none is passed', () => {
    render(<Button>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button.querySelector('svg')).toBeNull();
    expect(button).toHaveClass('px-3');
  });
});
