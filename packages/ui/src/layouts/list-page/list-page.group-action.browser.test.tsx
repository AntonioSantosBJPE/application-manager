import { render, screen } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Button } from '../../components/button';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { ListPage } from './list-page';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderGroups() {
  render(
    <ListPage.Root>
      <ListPage.Content>
        <ListPage.Group
          count={2}
          action={<Button intent="ghost" size="sm" icon={Plus} aria-label="Nova em Em entrevistas" />}
        >
          Em entrevistas
        </ListPage.Group>
        <ul aria-label="Em entrevistas">
          <ListPage.Row>
            <ListPage.RowText>Empresa Fictícia Alfa · Vaga de Teste Pleno</ListPage.RowText>
          </ListPage.Row>
        </ul>
      </ListPage.Content>
    </ListPage.Root>,
  );
  return screen.getByRole('button', { name: 'Nova em Em entrevistas' });
}

describe('ListPage.Group action in the browser', () => {
  it('APP-45 draws the 36px header with the action at the right edge, inside the gutter', async () => {
    await page.viewport(1280, 800);
    const action = renderGroups();
    const header = screen.getByRole('heading', { level: 2 }).parentElement!;

    const bounds = header.getBoundingClientRect();
    expect(bounds.height).toBe(36);
    expect(action.getBoundingClientRect().right).toBeCloseTo(bounds.right - 24, 0);
    expect(screen.getByRole('heading', { level: 2 }).getBoundingClientRect().left).toBeCloseTo(
      bounds.left + 24,
      0,
    );
  });

  it('APP-45 reaches the action with Tab, draws the focus ring and has no axe violation, in both themes', async () => {
    const action = renderGroups();
    await userEvent.tab();
    expect(document.activeElement).toBe(action);

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(action);
      const ring = focusRing(action);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(action.closest('main')!), theme).toEqual([]);
    }
  });
});
