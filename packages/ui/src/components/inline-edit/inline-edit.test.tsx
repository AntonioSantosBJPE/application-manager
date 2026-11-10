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

  it('draws the value from visibleFrom on, while the name and the edit field keep the whole value', async () => {
    const user = userEvent.setup();
    render(
      <InlineEdit
        value="https://vagas.exemplo.com/1234"
        label="Editar link da vaga"
        visibleFrom={(value) => value.match(/^https?:\/\//)?.[0].length ?? 0}
        onCommit={() => {}}
      />,
    );

    const button = screen.getByRole('button', { name: 'Editar link da vaga https://vagas.exemplo.com/1234' });
    expect(button.textContent).toBe('Editar link da vaga https://vagas.exemplo.com/1234');
    const cut = screen.getByText('https://');
    expect(cut).toHaveClass('sr-only');
    expect(cut.parentElement?.textContent).toBe('https://vagas.exemplo.com/1234');

    await user.click(button);

    expect(screen.getByRole('textbox', { name: 'Editar link da vaga' })).toHaveValue('https://vagas.exemplo.com/1234');
  });

  it('keeps the empty text while the value is empty, whatever visibleFrom says', () => {
    render(<InlineEdit value="" label="Editar link da vaga" emptyText="—" visibleFrom={() => 99} onCommit={() => {}} />);

    expect(screen.getByRole('button', { name: 'Editar link da vaga —' })).toBeInTheDocument();
  });
});

function MultilineHarness({
  initial = 'Reduziu o tempo de resposta da API em 40%.',
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
      <InlineEdit
        multiline
        value={value}
        label="Editar texto"
        emptyText="Sem texto"
        maxLength={500}
        onCommit={(next) => {
          setValue(next);
          onCommit(next);
        }}
      />
      <button type="button">Depois</button>
    </form>
  );
}

const multilineDisplay = () => screen.getByRole('button', { name: /^Editar texto / });
const multilineField = () => screen.getByRole('textbox', { name: 'Editar texto' });

describe('InlineEdit multiline', () => {
  it('RES-64 shows the value on a button that wraps instead of truncating, named by the caller', () => {
    render(<MultilineHarness />);

    expect(multilineDisplay()).toHaveAccessibleName('Editar texto Reduziu o tempo de resposta da API em 40%.');
    expect(multilineDisplay().querySelector('.truncate')).toBeNull();
    expect(multilineDisplay()).toHaveClass('min-h-control-md');
    expect(multilineDisplay()).not.toHaveClass('h-control-md');
  });

  it('RES-64 opens a textarea with the value, the focus, the text selected and the props of the input', async () => {
    const user = userEvent.setup();
    render(<MultilineHarness />);

    await user.click(multilineDisplay());

    expect(multilineField().tagName).toBe('TEXTAREA');
    expect(multilineField()).toHaveValue('Reduziu o tempo de resposta da API em 40%.');
    expect(multilineField()).toHaveFocus();
    expect((multilineField() as HTMLTextAreaElement).selectionStart).toBe(0);
    expect((multilineField() as HTMLTextAreaElement).selectionEnd).toBe(42);
    expect(multilineField()).toHaveAttribute('maxlength', '500');
    expect(multilineField()).toHaveClass('field-sizing-content');
  });

  it('RES-64 commits once with Enter, puts no line break in the text and does not submit the form', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onSubmit = vi.fn();
    render(<MultilineHarness onCommit={onCommit} onSubmit={onSubmit} />);
    await user.click(multilineDisplay());

    await user.keyboard('Texto novo{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Texto novo');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(multilineDisplay()).toHaveTextContent('Texto novo');
    expect(multilineDisplay()).toHaveFocus();
  });

  it('RES-64 turns a pasted line break into a space', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<MultilineHarness onCommit={onCommit} />);
    await user.click(multilineDisplay());

    await user.paste('linha um\nlinha dois');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('linha um linha dois');
  });

  it('RES-64 commits once when the focus leaves the field and leaves the focus where it went', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<MultilineHarness onCommit={onCommit} />);
    await user.click(multilineDisplay());

    await user.keyboard('Outro texto');
    await user.click(screen.getByRole('button', { name: 'Depois' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Outro texto');
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
  });

  it('RES-64 drops the edit on Esc: no commit, the saved text is back and the button has the focus', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<MultilineHarness onCommit={onCommit} />);
    await user.click(multilineDisplay());

    await user.keyboard('descartado{Escape}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(multilineDisplay()).toHaveTextContent('Reduziu o tempo de resposta da API em 40%.');
    expect(multilineDisplay()).toHaveFocus();
  });

  it('RES-64 shows the empty text while the value is empty and marks the textarea invalid when told', async () => {
    const user = userEvent.setup();
    render(<InlineEdit multiline value="" label="Editar texto" emptyText="Sem texto" invalid onCommit={() => {}} />);

    expect(multilineDisplay()).toHaveAccessibleName('Editar texto Sem texto');
    await user.click(multilineDisplay());

    expect(multilineField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('RES-85 keeps the field open with the text and the sentence of the caller, and commits nothing, when validate refuses', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <InlineEdit
        multiline
        value="Texto salvo"
        label="Editar texto"
        validate={(text) => (text.length > 10 ? 'Texto longo demais.' : null)}
        onCommit={onCommit}
      />,
    );
    await user.click(multilineDisplay());

    await user.paste('um texto colado bem comprido');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(multilineField()).toHaveValue('um texto colado bem comprido');
    expect(multilineField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Texto longo demais.')).toBeInTheDocument();
  });

  it('RES-85 commits once the text passes validate', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <InlineEdit
        multiline
        value="Texto salvo"
        label="Editar texto"
        validate={(text) => (text.length > 10 ? 'Texto longo demais.' : null)}
        onCommit={onCommit}
      />,
    );
    await user.click(multilineDisplay());
    await user.paste('um texto colado bem comprido');
    await user.tab();

    await user.clear(multilineField());
    await user.type(multilineField(), 'curto{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('curto');
    expect(screen.queryByText('Texto longo demais.')).toBeNull();
  });
});
