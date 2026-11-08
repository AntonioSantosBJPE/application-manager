import { render, screen } from '@testing-library/react';
import { LogOut, RefreshCw } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { Button } from './button';

/** A CSS color as the browser resolves it, to compare with a computed style. */
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

describe('Button in the browser', () => {
  it('PRU-01 AC11 paints the icon of a Button 16px or 14px in the label color, and an icon-only button square', async () => {
    render(
      <div>
        <Button intent="secondary" icon={RefreshCw}>
          Tentar novamente
        </Button>
        <Button intent="ghost" size="sm" icon={LogOut} aria-label="Sair" />
        <Button intent="ghost" icon={LogOut} aria-label="Sair agora" />
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      const retry = screen.getByRole('button', { name: 'Tentar novamente' });
      await settle(retry);
      const icon = retry.querySelector('svg')!;
      expect(icon.getBoundingClientRect().width, theme).toBe(16);
      expect(getComputedStyle(icon).stroke, theme).toBe(getComputedStyle(retry).color);
      const label = document.createRange();
      label.selectNodeContents(retry.lastChild!);
      expect(icon.getBoundingClientRect().right, theme).toBeLessThanOrEqual(
        label.getBoundingClientRect().left,
      );
    }
    const small = screen.getByRole('button', { name: 'Sair' }).getBoundingClientRect();
    const large = screen.getByRole('button', { name: 'Sair agora' }).getBoundingClientRect();
    expect([small.width, small.height]).toEqual([28, 28]);
    expect([large.width, large.height]).toEqual([32, 32]);
    expect(screen.getByRole('button', { name: 'Sair' }).querySelector('svg')!.getBoundingClientRect().width).toBe(14);
  });

  it('PRU-02 AC02 measures 32px by default and 28px with size sm', () => {
    render(
      <div>
        <Button>Entrar</Button>
        <Button size="sm">Revogar</Button>
        <Button intent="ghost" size="sm">
          Ver convites
        </Button>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Entrar' }).getBoundingClientRect().height).toBe(32);
    expect(screen.getByRole('button', { name: 'Revogar' }).getBoundingClientRect().height).toBe(28);
    expect(screen.getByRole('button', { name: 'Ver convites' }).getBoundingClientRect().height).toBe(
      28,
    );
  });

  it('PRU-02 AC03 paints a disabled button at 50% opacity and ignores a real click', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Entrar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(getComputedStyle(button).opacity).toBe('0.5');

    await userEvent.click(button, { force: true });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('PRU-02 AC04 paints the label of primary and danger in on-accent, in both themes', async () => {
    render(
      <div>
        <Button intent="primary">Entrar</Button>
        <Button intent="danger">Revogar</Button>
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const name of ['Entrar', 'Revogar']) {
        const button = screen.getByRole('button', { name });
        await settle(button);
        const label = getComputedStyle(button).color;
        expect(label, `${name}, ${theme}`).toBe(tokenColor('on-accent'));
      }
    }
  });
});
