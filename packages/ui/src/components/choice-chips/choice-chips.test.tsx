import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from '../field';
import { ChoiceChips } from './choice-chips';

const levels = [
  { value: 'intern', label: 'Estágio' },
  { value: 'junior', label: 'Júnior' },
  { value: 'mid', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
];

function Harness({
  initial = null,
  onValueChange = vi.fn(),
  invalid = false,
}: {
  initial?: string | null;
  onValueChange?: (value: string) => void;
  invalid?: boolean;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <button type="button">Antes</button>
      <Field.Root invalid={invalid}>
        <span id="nivel">Nível</span>
        <ChoiceChips
          aria-labelledby="nivel"
          options={levels}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
        />
        <Field.Hint>Escolha o nível da vaga.</Field.Hint>
        <Field.Error>Escolha um nível.</Field.Error>
      </Field.Root>
      <button type="button">Depois</button>
    </>
  );
}

const chip = (name: string) => screen.getByRole('radio', { name });

describe('ChoiceChips', () => {
  it('APP-57 is a radio group named by the caller with one radio per option', () => {
    render(<Harness initial="mid" />);

    expect(screen.getByRole('radiogroup', { name: 'Nível' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Estágio',
      'Júnior',
      'Pleno',
      'Sênior',
    ]);
  });

  it('APP-57 marks only the chosen chip with aria-checked="true"', () => {
    render(<Harness initial="mid" />);

    expect(chip('Pleno')).toHaveAttribute('aria-checked', 'true');
    for (const name of ['Estágio', 'Júnior', 'Sênior']) {
      expect(chip(name)).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('APP-57 chooses a chip with a click, reports it once and moves the mark', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness initial="mid" onValueChange={onValueChange} />);

    await user.click(chip('Sênior'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('senior');
    expect(chip('Sênior')).toHaveAttribute('aria-checked', 'true');
    expect(chip('Pleno')).toHaveAttribute('aria-checked', 'false');
  });

  it('APP-57 is a single tab stop: the chosen chip, and the first one when none is chosen', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial="junior" />);

    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual([chip('Júnior')]);
    screen.getByRole('button', { name: 'Antes' }).focus();
    await user.tab();
    expect(chip('Júnior')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    unmount();

    render(<Harness />);
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual([chip('Estágio')]);
  });

  it('APP-72 moves and chooses with the arrows, wrapping around at both ends', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness initial="mid" onValueChange={onValueChange} />);
    chip('Pleno').focus();

    await user.keyboard('{ArrowRight}');
    expect(chip('Sênior')).toHaveFocus();
    expect(chip('Sênior')).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowRight}');
    expect(chip('Estágio')).toHaveFocus();
    expect(chip('Estágio')).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(chip('Sênior')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(chip('Pleno')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(chip('Sênior')).toHaveFocus();

    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([
      'senior',
      'intern',
      'senior',
      'mid',
      'senior',
    ]);
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual([chip('Sênior')]);
  });

  it('APP-57 chooses the focused chip with Space', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    chip('Estágio').focus();

    await user.keyboard(' ');

    expect(chip('Estágio')).toHaveAttribute('aria-checked', 'true');
  });

  it('APP-57 takes the invalid state and the description from Field.Root', () => {
    const { rerender } = render(<Harness invalid={false} initial="mid" />);
    const group = screen.getByRole('radiogroup');
    expect(group).not.toHaveAttribute('aria-invalid');
    expect(group).toHaveAccessibleDescription('Escolha o nível da vaga.');
    expect(screen.queryByText('Escolha um nível.')).toBeNull();

    rerender(<Harness invalid initial="mid" />);

    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(
      'Escolha o nível da vaga. Escolha um nível.',
    );
    expect(chip('Júnior')).toHaveClass('border-danger');
  });

  it('APP-57 works outside a Field.Root too', () => {
    render(<ChoiceChips aria-label="Modelo" options={levels} value={null} onValueChange={() => {}} />);

    expect(screen.getByRole('radiogroup', { name: 'Modelo' })).not.toHaveAttribute('aria-invalid');
  });
});
