import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { Field } from '../field';
import { Dialog } from './dialog';

function renderDialog(onSubmit = vi.fn()) {
  const user = userEvent.setup();
  render(
    <div>
      <button type="button">Antes</button>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button intent="secondary">Editar</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Editar skill</Dialog.Title>
          <Dialog.Description>Corrija o nome ou a categoria.</Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <Field.Root>
              <Field.Label htmlFor="nome">Nome</Field.Label>
              <Field.Control id="nome" defaultValue="Skill Fictícia Alfa" />
            </Field.Root>
            <Dialog.Footer>
              <Dialog.Close asChild>
                <Button intent="secondary">Cancelar</Button>
              </Dialog.Close>
              <Button intent="primary" type="submit">
                Salvar
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>
      <button type="button">Depois</button>
    </div>,
  );
  return { user, onSubmit, trigger: screen.getByRole('button', { name: 'Editar' }) };
}

describe('Dialog', () => {
  it('opens from the trigger with the title as its name and the description as its description', async () => {
    const { user, trigger } = renderDialog();

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Editar skill' });
    expect(dialog).toHaveAccessibleDescription('Corrija o nome ou a categoria.');
    expect(screen.getByLabelText('Nome')).toHaveValue('Skill Fictícia Alfa');
  });

  it('moves the focus into the dialog when it opens', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Esc and returns the focus to the trigger', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on the Close part and returns the focus to the trigger', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the open dialog', async () => {
    const { user, trigger } = renderDialog();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement), `Tab ${step + 1}`).toBe(true);
    }
    for (let step = 0; step < 6; step += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `Shift+Tab ${step + 1}`).toBe(true);
    }
  });

  it('does not close on submit by itself: the caller decides when the work is done', async () => {
    const { user, onSubmit, trigger } = renderDialog();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is controlled by open and onOpenChange', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Content>
            <Dialog.Title>Editar skill</Dialog.Title>
            <Dialog.Description>Corrija o nome.</Dialog.Description>
          </Dialog.Content>
        </Dialog.Root>
      );
    }
    render(<Controlled />);

    expect(screen.getByRole('dialog', { name: 'Editar skill' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('floats on the surface of the ConfirmDialog over the backdrop', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(
      'bg-surface-overlay',
      'border-border-strong',
      'rounded-lg',
      'shadow-overlay',
      'max-w-110',
    );
    expect(dialog.previousElementSibling).toHaveClass('bg-backdrop', 'fixed', 'inset-0');
    expect(screen.getByRole('heading', { name: 'Editar skill' })).toHaveClass('text-heading-md');
    expect(screen.getByText('Corrija o nome ou a categoria.')).toHaveClass('text-text-muted');
  });
});

describe('Dialog with a combobox inside', () => {
  it('leaves Esc to a combobox whose list is open and closes on the next Esc', async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Apelido</Dialog.Title>
          <Dialog.Description>Escolha a skill.</Dialog.Description>
          <input
            role="combobox"
            aria-label="Skill"
            aria-expanded="true"
            aria-controls="lista"
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.setAttribute('aria-expanded', 'false');
            }}
          />
        </Dialog.Content>
      </Dialog.Root>,
    );
    screen.getByRole('combobox', { name: 'Skill' }).focus();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
