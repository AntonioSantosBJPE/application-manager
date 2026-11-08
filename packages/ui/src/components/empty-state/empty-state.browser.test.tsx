import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { EmptyState } from './empty-state';

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

describe('EmptyState in the browser', () => {
  it('PRU-07 AC03 paints a dashed border-strong box with radius-md, left aligned, with the sentence in text-muted', async () => {
    await page.viewport(1280, 800);
    const { container } = render(
      <EmptyState.Root>
        <p>Nenhuma candidatura ainda. Cadastre a primeira vaga para começar o pipeline.</p>
        <EmptyState.Action>
          <Button>Nova candidatura</Button>
        </EmptyState.Action>
      </EmptyState.Root>,
    );
    const box = container.firstElementChild as HTMLElement;
    const sentence = screen.getByText(/Nenhuma candidatura ainda/);
    const action = screen.getByRole('button', { name: 'Nova candidatura' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(box);
      const style = getComputedStyle(box);
      expect(style.borderTopStyle).toBe('dashed');
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.borderTopLeftRadius).toBe('6px');
      expect(getComputedStyle(sentence).color, theme).toBe(tokenColor('text-muted'));
    }
    // Left aligned: the sentence and the action start at the same left edge, inside the padding.
    const inner = box.getBoundingClientRect();
    expect(sentence.getBoundingClientRect().left).toBe(inner.left + 1 + 24);
    expect(action.getBoundingClientRect().left).toBe(inner.left + 1 + 24);
    expect(getComputedStyle(sentence).textAlign).toMatch(/^(start|left)$/);
    expect(box.querySelector('img, svg')).toBeNull();
  });
});
