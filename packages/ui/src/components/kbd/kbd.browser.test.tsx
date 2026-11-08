import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { Kbd } from './kbd';

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

describe('Kbd in the browser', () => {
  it('PRU-07 AC01 paints a mono 11px/500 key, 18px tall, with border-strong on surface-raised, in both themes', async () => {
    render(<Kbd>K</Kbd>);
    const key = screen.getByText('K');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(key);
      const style = getComputedStyle(key);
      expect(key.getBoundingClientRect().height).toBe(18);
      expect(key.getBoundingClientRect().width).toBeGreaterThanOrEqual(18);
      expect(style.fontFamily).toMatch(/^"Geist Mono Variable"/);
      expect(style.fontSize).toBe('11px');
      expect(style.fontWeight).toBe('500');
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.backgroundColor, theme).toBe(tokenColor('surface-raised'));
      expect(style.color, theme).toBe(tokenColor('text-muted'));
    }
  });

  it('PRU-07 AC02 paints text and border in on-accent inside a primary Button, in both themes', async () => {
    render(
      <Button intent="primary">
        Nova candidatura <Kbd tone="on-accent">C</Kbd>
      </Button>,
    );
    const key = screen.getByText('C');
    const button = screen.getByRole('button');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(button);
      await settle(key);
      const style = getComputedStyle(key);
      expect(style.color, theme).toBe(tokenColor('on-accent'));
      expect(style.borderTopColor, theme).toBe(tokenColor('on-accent'));
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(button).color, theme).toBe(tokenColor('on-accent'));
      expect(key.getBoundingClientRect().height).toBe(18);
    }
  });
});
