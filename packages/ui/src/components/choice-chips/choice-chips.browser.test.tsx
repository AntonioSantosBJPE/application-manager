import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { Field } from '../field';
import { ChoiceChips } from './choice-chips';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const models = [
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'onsite', label: 'Presencial' },
];

function Harness({ invalid = false }: { invalid?: boolean }) {
  const [value, setValue] = useState<string | null>('hybrid');
  return (
    <div className="bg-surface p-4">
      <button type="button">Antes</button>
      <Field.Root invalid={invalid}>
        <Field.Label id="modelo">Modelo</Field.Label>
        <ChoiceChips aria-labelledby="modelo" options={models} value={value} onValueChange={setValue} />
        <Field.Error>Escolha um modelo.</Field.Error>
      </Field.Root>
      <button type="button">Depois</button>
    </div>
  );
}

const chip = (name: string) => screen.getByRole('radio', { name });

describe('ChoiceChips in the browser', () => {
  it('APP-72 enters the group on one Tab, walks with the real arrows and leaves on the next Tab', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Antes' }));

    await userEvent.tab();
    expect(document.activeElement).toBe(chip('Híbrido'));

    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(chip('Presencial'));
    expect(chip('Presencial').getAttribute('aria-checked')).toBe('true');
    expect(chip('Híbrido').getAttribute('aria-checked')).toBe('false');

    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(chip('Remoto'));

    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Depois' }));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(chip('Remoto'));
  });

  it('APP-57 draws the focus ring on the focused chip and has no axe violation, valid and invalid, in both themes', async () => {
    const { rerender } = render(<Harness />);
    await userEvent.tab();
    await userEvent.tab();
    const group = screen.getByRole('radiogroup');

    for (const invalid of [false, true]) {
      rerender(<Harness invalid={invalid} />);
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        await settle(group);
        const ring = focusRing(document.activeElement as HTMLElement);
        expect(ring.drawn, `${theme} invalid=${invalid}`).toBe(true);
        expect(ring.isFocusToken, `${theme} invalid=${invalid}`).toBe(true);
        expect(await axeViolations(group.parentElement!), `${theme} invalid=${invalid}`).toEqual([]);
      }
    }
  });
});
