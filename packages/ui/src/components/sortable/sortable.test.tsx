import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sortable, type SortableAnnouncements } from './sortable';

const announcements: SortableAnnouncements = {
  onPick: () => 'p1',
  onMove: () => 'p2',
  onDrop: () => 'p3',
  onCancel: () => 'p4',
};

function List() {
  return (
    <Sortable.List
      aria-label="l1"
      ids={['a', 'b']}
      instructions="l2"
      announcements={announcements}
      onReorder={() => {}}
    >
      <Sortable.Item id="a">
        <Sortable.Handle label="h1" />
        i1
      </Sortable.Item>
      <Sortable.Item id="b">
        <Sortable.Handle label="h2" />
        i2
      </Sortable.Item>
    </Sortable.List>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sortable', () => {
  it('RES-76 renders a named list of items with a named handle each and no text of its own', () => {
    render(<List />);

    const list = screen.getByRole('list', { name: 'l1' });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(list.textContent).toBe('i1i2');
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['h1', 'h2']);
    expect(document.body.textContent).toContain('l2');
  });

  it('RES-76 renders no role description of its own when the caller passes none', () => {
    render(<List />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-roledescription');
    }
  });

  it('RES-76 hydrates what the server rendered without an id warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = renderToString(<List />);
    const rendered = container.innerHTML;

    const mismatch = vi.fn();
    await act(async () => {
      hydrateRoot(container, <List />, { onRecoverableError: mismatch });
    });

    const describedBy = container.querySelector('button')!.getAttribute('aria-describedby')!;
    expect(rendered).toContain(`aria-describedby="${describedBy}"`);
    expect(container.querySelector('button')!.getAttribute('aria-describedby')).toBe(describedBy);
    expect(document.getElementById(describedBy)?.textContent).toBe('l2');
    expect(mismatch).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    container.remove();
  });
});
