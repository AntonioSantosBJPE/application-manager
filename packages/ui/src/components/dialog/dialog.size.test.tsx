import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog } from './dialog';

function renderDialog(size?: 'md' | 'lg') {
  render(
    <Dialog.Root defaultOpen>
      <Dialog.Content size={size}>
        <Dialog.Title>Nova candidatura</Dialog.Title>
        <Dialog.Description>Cadastre a vaga.</Dialog.Description>
      </Dialog.Content>
    </Dialog.Root>,
  );
  return screen.getByRole('dialog', { name: 'Nova candidatura' });
}

describe('Dialog.Content size', () => {
  it('APP-57 caps the large dialog at 640px and leaves the default at 440px', () => {
    const large = renderDialog('lg');
    expect(large).toHaveClass('max-w-160');
    expect(large).not.toHaveClass('max-w-110');
  });

  it('APP-57 keeps the default size at 440px', () => {
    const regular = renderDialog();
    expect(regular).toHaveClass('max-w-110');
    expect(regular).not.toHaveClass('max-w-160');
  });

  it('APP-57 keeps closing on Esc in the large dialog', async () => {
    renderDialog('lg');
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
