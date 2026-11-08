import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InlineEdit } from './inline-edit';

function Harness({
  initial = 'Recife, PE',
  onCommit = vi.fn(),
  onSubmit = vi.fn(),
}: {
  initial?: string;
  onCommit?: (value: string) => void;
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <button type="button">Antes</button>
      <InlineEdit
        value={value}
        label="Editar local"
        emptyText="Sem local"
        maxLength={40}
        onCommit={(next) => {
          setValue(next);
          onCommit(next);
        }}
      />
      <button type="button">Depois</button>
    </form>
  );
}

const display = () => screen.getByRole('button', { name: /^Editar local / });
const field = () => screen.getByRole('textbox', { name: 'Editar local' });

describe('InlineEdit', () => {
  it('APP-68 shows the value on a button named by the caller, with no field', () => {
    render(<Harness />);

    expect(display()).toHaveAccessibleName('Editar local Recife, PE');
    expect(display()).toHaveTextContent('Recife, PE');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('APP-68 names the button with the empty text too, so the name holds what is on the button', () => {
    render(<Harness initial="" />);

    expect(display()).toHaveAccessibleName('Editar local Sem local');
  });

  it('APP-68 shows the empty text, in text-muted, when the value is empty', () => {
    render(<Harness initial="" />);

    expect(display()).toHaveTextContent('Sem local');
    expect(display()).toHaveClass('text-text-muted');
  });

  it('APP-68 turns into a field with the value, focus and the text selected on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(display());

    expect(screen.queryByRole('button', { name: /^Editar local / })).toBeNull();
    expect(field()).toHaveValue('Recife, PE');
    expect(field()).toHaveFocus();
    expect((field() as HTMLInputElement).selectionStart).toBe(0);
    expect((field() as HTMLInputElement).selectionEnd).toBe('Recife, PE'.length);
    expect(field()).toHaveAttribute('maxlength', '40');
  });

  it('APP-68 opens with Enter or Space on the focused button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    display().focus();

    await user.keyboard('{Enter}');

    expect(field()).toHaveFocus();
  });

  it('APP-68 commits the typed text once with Enter, shows it and puts the focus back on the button', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness onCommit={onCommit} onSubmit={onSubmit} />);
    await user.click(display());

    await user.keyboard('Olinda, PE{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Olinda, PE');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(display()).toHaveTextContent('Olinda, PE');
    expect(display()).toHaveFocus();
  });

  it('APP-68 commits the typed text once when the focus leaves the field, and leaves the focus where it went', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.click(display());

    await user.keyboard('Olinda, PE');
    await user.click(screen.getByRole('button', { name: 'Depois' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Olinda, PE');
    expect(display()).toHaveTextContent('Olinda, PE');
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
  });

  it('APP-68 drops the edit on Esc: no commit, the previous value is back and the button has the focus', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.click(display());

    await user.keyboard('Olinda, PE{Escape}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(display()).toHaveTextContent('Recife, PE');
    expect(display()).toHaveFocus();
  });

  it('APP-68 starts the next edit from the saved value, not from the dropped text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(display());
    await user.keyboard('Olinda, PE{Escape}');

    await user.click(display());

    expect(field()).toHaveValue('Recife, PE');
  });

  it('APP-68 commits again on a second edit, once each time', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    await user.click(display());
    await user.keyboard('A{Enter}');
    await user.click(display());
    await user.keyboard('B{Enter}');

    expect(onCommit.mock.calls).toEqual([['A'], ['B']]);
  });

  it('APP-68 commits an emptied field as an empty value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.click(display());

    await user.keyboard('{Backspace}{Enter}');

    expect(onCommit).toHaveBeenCalledWith('');
    expect(display()).toHaveTextContent('Sem local');
  });

  it('APP-68 marks the field invalid while editing when the caller says so', async () => {
    const user = userEvent.setup();
    render(<InlineEdit value="x" label="Editar local" invalid onCommit={() => {}} />);

    await user.click(display());

    expect(field()).toHaveAttribute('aria-invalid', 'true');
  });
});
