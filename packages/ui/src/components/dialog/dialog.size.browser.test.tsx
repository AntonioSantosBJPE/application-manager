import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { settle } from '../../testing/contrast';
import { Dialog } from './dialog';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function renderLarge() {
  render(
    <Dialog.Root defaultOpen>
      <Dialog.Content size="lg">
        <Dialog.Title>Nova candidatura</Dialog.Title>
        <Dialog.Description>Cadastre a vaga.</Dialog.Description>
      </Dialog.Content>
    </Dialog.Root>,
  );
  return screen.getByRole('dialog', { name: 'Nova candidatura' });
}

describe('large Dialog in the browser', () => {
  it('APP-57 is 640px wide on a wide screen, in both themes', async () => {
    await page.viewport(1280, 800);
    const dialog = renderLarge();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      expect(dialog.getBoundingClientRect().width, theme).toBe(640);
    }
  });

  it('APP-57 shrinks to a 375px viewport', async () => {
    await page.viewport(375, 700);
    const bounds = renderLarge().getBoundingClientRect();

    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('APP-57 has no axe violation, in both themes', async () => {
    const dialog = renderLarge();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(dialog);
      expect(await axeViolations(dialog), theme).toEqual([]);
    }
  });
});
