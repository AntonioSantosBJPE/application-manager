import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { SearchInput } from './search-input';

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

function renderInput() {
  render(
    <div className="bg-surface p-4">
      <SearchInput aria-label="Nome ou apelido" placeholder="Nome ou apelido" wrapperClassName="w-55" />
    </div>,
  );
  return screen.getByRole('searchbox', { name: 'Nome ou apelido' });
}

describe('SearchInput in the browser', () => {
  it('paints a 28px field with the control border and a 14px muted icon inside it, in both themes', async () => {
    const input = renderInput();
    const icon = document.querySelector('svg')!;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(input);
      expect(input.getBoundingClientRect().height).toBe(28);
      expect(getComputedStyle(input).borderTopColor, theme).toBe(tokenColor('border-control'));
      expect(getComputedStyle(input).backgroundColor, theme).toBe(tokenColor('surface'));
      expect(icon.getBoundingClientRect().width).toBe(14);
      expect(getComputedStyle(icon).color, theme).toBe(tokenColor('text-muted'));
      expect(icon.getBoundingClientRect().right).toBeLessThanOrEqual(input.getBoundingClientRect().left + 28);
    }
  });

  it('accepts real typing and draws the focus ring in the focus token when reached by Tab', async () => {
    const input = renderInput();

    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('nest');
    expect(input).toHaveValue('nest');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(input);
      const ring = focusRing(input);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(ring.ratio, theme).toBeGreaterThanOrEqual(3);
    }
  });

  it('has no axe violation in both themes', async () => {
    const input = renderInput();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(input);
      expect(await axeViolations(), theme).toEqual([]);
    }
  });
});
