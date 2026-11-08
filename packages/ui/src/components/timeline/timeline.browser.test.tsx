import { render, screen } from '@testing-library/react';
import { MessageSquare, UserRound } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../testing/axe';
import { settle } from '../../testing/contrast';
import { Timeline } from './timeline';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderTimeline() {
  render(
    <div className="w-96 bg-surface p-4">
      <Timeline.Root aria-label="Histórico">
        <Timeline.Item icon={MessageSquare} date="20 out">
          <Timeline.Emphasis>Nota</Timeline.Emphasis> · retorna em duas semanas
        </Timeline.Item>
        <Timeline.Item icon={UserRound} date="18 out">
          Etapa <Timeline.Emphasis>RH</Timeline.Emphasis> concluída
        </Timeline.Item>
        <Timeline.Item icon={MessageSquare} date="14 out">
          Vaga cadastrada
        </Timeline.Item>
      </Timeline.Root>
    </div>,
  );
  return screen.getByRole('list', { name: 'Histórico' });
}

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

describe('Timeline in the browser', () => {
  it('APP-70 draws a 1px line in border from each item to the next and none after the last, in both themes', async () => {
    const list = renderTimeline();
    const items = [...list.querySelectorAll('li')];

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(list);
      for (const item of items.slice(0, -1)) {
        const line = getComputedStyle(item, '::before');
        expect(line.display, theme).toBe('block');
        expect(line.width, theme).toBe('1px');
        expect(line.backgroundColor, theme).toBe(tokenColor('border'));
      }
      expect(getComputedStyle(items.at(-1)!, '::before').display, theme).toBe('none');
    }
  });

  it('APP-70 puts the icon column, the text and the date side by side, the date at the right', () => {
    const list = renderTimeline();
    const item = list.querySelector('li')!;
    const [icon, text, date] = [...item.children].map((child) => child.getBoundingClientRect());

    expect(icon!.width).toBe(20);
    expect(text!.left).toBeGreaterThan(icon!.right);
    expect(date!.left).toBeGreaterThanOrEqual(text!.right);
    expect(date!.right).toBeCloseTo(item.getBoundingClientRect().right, 0);
  });

  it('APP-70 has no axe violation, in both themes', async () => {
    const list = renderTimeline();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(list);
      expect(await axeViolations(list), theme).toEqual([]);
    }
  });
});
