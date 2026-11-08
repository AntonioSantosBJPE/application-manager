// @vitest-environment jsdom
import type { AdminSkill } from '@am/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillRow } from './SkillRow';

const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

const globalSkill: AdminSkill = {
  id: uuid(1),
  name: 'Skill Fictícia Alfa',
  category: 'language',
  scope: 'global',
  aliases: [
    { id: uuid(11), alias: 'alfa' },
    { id: uuid(12), alias: 'alfa-js' },
  ],
};
const privateSkill: AdminSkill = {
  id: uuid(2),
  name: 'Drizzle ORM de Teste',
  category: 'tool',
  scope: 'private',
  aliases: [],
};

function renderRow(skill: AdminSkill, handlers: Partial<Parameters<typeof SkillRow>[0]> = {}) {
  const props = {
    onPromote: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onAliases: vi.fn(),
    ...handlers,
  };
  render(
    <ul>
      <SkillRow skill={skill} {...props} />
    </ul>,
  );
  return { ...props, row: screen.getByRole('listitem') };
}

describe('SkillRow', () => {
  it('SKL-40 shows a global row with the name, the aliases separated by commas, the category label and the menu only', () => {
    const { row } = renderRow(globalSkill);

    expect(within(row).getByText('Skill Fictícia Alfa')).toBeInTheDocument();
    expect(within(row).getByText('alfa, alfa-js')).toBeInTheDocument();
    expect(within(row).getByText('Linguagem')).toBeInTheDocument();
    expect(within(row).queryByText('Privada')).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Promover' })).toBeNull();
    expect(
      within(row).getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }),
    ).toBeInTheDocument();
  });

  it('SKL-40 shows a global row without aliases with a dash', () => {
    const { row } = renderRow({ ...globalSkill, aliases: [] });

    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('SKL-40 shows a private row with the Privada badge, a dash for the aliases and the button Promover, without the menu', () => {
    const { row } = renderRow(privateSkill);

    expect(within(row).getByText('Drizzle ORM de Teste')).toBeInTheDocument();
    expect(within(row).getByText('Privada')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('Ferramenta')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Promover' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Ações de/ })).toBeNull();
  });

  it('SKL-40 opens the menu of a global row with Enter and offers Editar and Apelidos', () => {
    const { row, onEdit, onAliases } = renderRow(globalSkill);
    const trigger = within(row).getByRole('button', { name: 'Ações de Skill Fictícia Alfa' });

    fireEvent.keyDown(trigger, { key: 'Enter' });

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Editar', 'Apelidos']);
    fireEvent.click(items[0]!);
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(globalSkill);
    expect(onAliases).not.toHaveBeenCalled();
  });

  it('SKL-40 hands the private skill to the promotion only after the confirmation', async () => {
    const { row, onPromote } = renderRow(privateSkill);

    fireEvent.click(within(row).getByRole('button', { name: 'Promover' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(onPromote).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Promover' }));

    expect(onPromote).toHaveBeenCalledExactlyOnceWith(privateSkill);
  });
});
