import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { contrastRatio, settle } from '../../testing/contrast';
import { PipelineStatus, type PipelineStatusValue } from './pipeline-status';

const statuses: PipelineStatusValue[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
];

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

describe('PipelineStatus in the browser', () => {
  it('PRU-07 AC04 paints a 14px icon in the status token, in both themes', async () => {
    const { container } = render(
      <div className="bg-surface">
        {statuses.map((status) => (
          <PipelineStatus key={status} status={status} label={status} iconOnly />
        ))}
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const status of statuses) {
        const icon = container.querySelector<SVGElement>(`[data-status-icon="${status}"]`)!;
        await settle(icon);
        expect(icon.getBoundingClientRect().width, status).toBe(14);
        expect(icon.getBoundingClientRect().height, status).toBe(14);
        expect(getComputedStyle(icon).color, `${status} ${theme}`).toBe(tokenColor(`status-${status}`));
      }
    }
  });

  it('PRU-07 AC04 paints the check and the X in surface over the full circle, at 3:1 or more', async () => {
    const { container } = render(
      <div className="bg-surface">
        <PipelineStatus status="accepted" label="Aceita" iconOnly />
        <PipelineStatus status="rejected" label="Recusada" iconOnly />
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const status of ['accepted', 'rejected']) {
        const icon = container.querySelector<SVGElement>(`[data-status-icon="${status}"]`)!;
        await settle(icon);
        const mark = icon.querySelector('path')!;
        expect(getComputedStyle(mark).stroke, `${status} ${theme}`).toBe(tokenColor('surface'));
        expect(
          contrastRatio(getComputedStyle(mark).stroke, getComputedStyle(icon.querySelector('circle')!).fill),
          `${status} ${theme}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('PRU-07 AC05 places the label to the right of the icon in text', async () => {
    const { container } = render(<PipelineStatus status="offer" label="Proposta" />);
    const icon = container.querySelector('svg')!.getBoundingClientRect();
    const label = container.querySelector('span > span')!;

    expect(label.getBoundingClientRect().left).toBeGreaterThan(icon.right);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(label);
      expect(getComputedStyle(label).color, theme).toBe(tokenColor('text'));
    }
  });
});
