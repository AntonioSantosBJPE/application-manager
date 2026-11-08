import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { SkillTag } from './skill-tag';

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

describe('SkillTag in the browser', () => {
  it('PRU-07 AC07 paints 22px tags in caption with the border and colors of each variant, in both themes', async () => {
    render(
      <div className="bg-surface">
        <SkillTag variant="required">TypeScript</SkillTag>
        <SkillTag variant="nice">Kubernetes</SkillTag>
        <SkillTag variant="private">Drizzle ORM</SkillTag>
        <SkillTag variant="match">React</SkillTag>
      </div>,
    );
    const required = screen.getByText('TypeScript');
    const nice = screen.getByText('Kubernetes');
    const match = screen.getByText(/React/);

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(required);
      for (const tag of [required, nice, screen.getByText(/Drizzle ORM/), match]) {
        expect(tag.getBoundingClientRect().height).toBe(22);
        expect(getComputedStyle(tag).fontSize).toBe('12px');
        expect(getComputedStyle(tag).borderTopLeftRadius).toBe('4px');
      }
      expect(getComputedStyle(required).borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(getComputedStyle(required).borderTopStyle).toBe('solid');
      expect(getComputedStyle(required).color, theme).toBe(tokenColor('text'));
      expect(getComputedStyle(nice).borderTopStyle).toBe('dashed');
      expect(getComputedStyle(nice).borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(getComputedStyle(nice).color, theme).toBe(tokenColor('text-muted'));
      expect(getComputedStyle(match).backgroundColor, theme).toBe(tokenColor('accent-subtle'));
      expect(getComputedStyle(match).color, theme).toBe(tokenColor('accent-text'));
      expect(match.querySelector('svg')!.getBoundingClientRect().width).toBe(14);
    }
  });

  it('PRU-07 AC08 removes with a real click and with the keyboard, once each', async () => {
    const onRemove = vi.fn();
    render(
      <SkillTag variant="required" onRemove={onRemove} removeLabel="Remover Terraform">
        Terraform
      </SkillTag>,
    );
    const button = screen.getByRole('button', { name: 'Remover Terraform' });

    expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(18);
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard('{Enter}');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(getComputedStyle(button).outlineStyle).toBe('solid');
    expect(getComputedStyle(button).outlineWidth).toBe('2px');

    await userEvent.click(button);
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
