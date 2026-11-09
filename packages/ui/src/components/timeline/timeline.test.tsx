import { render, screen, within } from '@testing-library/react';
import { MessageSquare, UserRound } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Timeline } from './timeline';

function renderTimeline() {
  return render(
    <Timeline.Root aria-label="Histórico">
      <Timeline.Item icon={MessageSquare} date="20 out">
        <Timeline.Emphasis>Nota</Timeline.Emphasis> · retorna em duas semanas
      </Timeline.Item>
      <Timeline.Item icon={UserRound} date="18 out">
        Etapa <Timeline.Emphasis>RH</Timeline.Emphasis> concluída
      </Timeline.Item>
      <Timeline.Item marker={<span data-testid="ring" />} date="14 out">
        Vaga cadastrada
      </Timeline.Item>
    </Timeline.Root>,
  );
}

describe('Timeline', () => {
  it('APP-70 is an ordered list with one list item per event, in the order given', () => {
    renderTimeline();

    const list = screen.getByRole('list', { name: 'Histórico' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Nota · retorna em duas semanas20 out',
      'Etapa RH concluída18 out',
      'Vaga cadastrada14 out',
    ]);
  });

  it('APP-70 hides the icon from assistive technology and keeps it out of the item name', () => {
    renderTimeline();

    const [first] = screen.getAllByRole('listitem');
    const svg = first!.querySelector('svg');
    expect(svg).toHaveClass('lucide-message-square');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg!.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('APP-70 draws a custom marker in the same decorative column when no icon is given', () => {
    renderTimeline();

    const ring = screen.getByTestId('ring');
    expect(ring.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(ring.closest('li')!.querySelector('svg')).toBeNull();
  });

  it('APP-70 sets the date in font-mono at text-muted', () => {
    renderTimeline();

    for (const date of ['20 out', '18 out', '14 out']) {
      expect(screen.getByText(date)).toHaveClass('font-mono', 'text-text-muted');
    }
  });

  it('APP-70 brings the emphasized words to the text color', () => {
    renderTimeline();

    expect(screen.getByText('RH').tagName).toBe('B');
    expect(screen.getByText('RH')).toHaveClass('font-medium', 'text-text');
  });

  it('APP-70 hides the connecting line on the last item only', () => {
    renderTimeline();

    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveClass('before:bg-border', 'last:before:hidden');
    }
  });

  it('APP-70 draws an item without a date', () => {
    render(
      <Timeline.Root>
        <Timeline.Item icon={MessageSquare}>Sem data</Timeline.Item>
      </Timeline.Root>,
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('Sem data');
  });
});
