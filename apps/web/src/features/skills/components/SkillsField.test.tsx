// @vitest-environment jsdom
import { normalizeSkillKey, type CreateSkillRequest, type Skill } from '@am/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Outcome } from '../../../lib/bff';
import { SkillsField, SKILLS_FIELD_HINT, type SkillsFieldApi, type SkillsFieldSkill } from './SkillsField';

const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

const nest: Skill = { id: uuid(1), name: 'NestJS', category: 'framework', scope: 'global' };
const node: Skill = { id: uuid(2), name: 'Node.js', category: 'tool', scope: 'global' };
const react: Skill = { id: uuid(3), name: 'React', category: 'framework', scope: 'global' };
const aliases: Record<string, string[]> = { [node.id]: ['node', 'nodejs'] };

/** The api as the field sees it: search by name or alias, and a create that answers a private skill. */
function fakeApi() {
  const catalog = [nest, node, react];
  const created: CreateSkillRequest[] = [];
  const searched: string[] = [];
  const api: SkillsFieldApi = {
    search: (q) => {
      searched.push(q);
      const key = normalizeSkillKey(q);
      const items = catalog.filter(
        (skill) =>
          normalizeSkillKey(skill.name).includes(key) ||
          (aliases[skill.id] ?? []).some((alias) => normalizeSkillKey(alias).includes(key)),
      );
      return Promise.resolve({ ok: true, data: items } as Outcome<Skill[]>);
    },
    create: (body) => {
      created.push(body);
      const skill: Skill = { id: uuid(100 + created.length), name: body.name, category: body.category, scope: 'private' };
      return Promise.resolve({ ok: true, data: skill } as Outcome<Skill>);
    },
  };
  return { api, created, searched };
}

/** Two fields over one state, as the form of an application keeps them. */
function Harness({
  api,
  initialRequired = [],
  initialNice = [],
  onChange,
}: {
  api: SkillsFieldApi;
  initialRequired?: SkillsFieldSkill[];
  initialNice?: SkillsFieldSkill[];
  onChange?: (required: SkillsFieldSkill[], nice: SkillsFieldSkill[]) => void;
}) {
  const [required, setRequired] = useState(initialRequired);
  const [nice, setNice] = useState(initialNice);
  return (
    <>
      <SkillsField
        label="Skills obrigatórias"
        requirement="required"
        skills={required}
        other={nice}
        api={api}
        onChange={(skills, other) => {
          setRequired(skills);
          setNice(other);
          onChange?.(skills, other);
        }}
      />
      <SkillsField
        label="Skills desejáveis"
        requirement="nice"
        skills={nice}
        other={required}
        api={api}
        onChange={(skills, other) => {
          setNice(skills);
          setRequired(other);
          onChange?.(other, skills);
        }}
      />
    </>
  );
}

/** The member types: one change event with the whole text, as the browser sends for a paste or the last key. */
const typeInto = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });

const required = () => screen.getByRole('combobox', { name: 'Skills obrigatórias' });
const nice = () => screen.getByRole('combobox', { name: 'Skills desejáveis' });
const removeButtons = () => screen.queryAllByRole('button', { name: /^Remover / }).map((b) => b.getAttribute('aria-label'));
const optionNames = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('SkillsField', () => {
  it('APP-59 shows the matches with official name and category and the hint while the member types', async () => {
    render(<Harness api={fakeApi().api} />);

    typeInto(required(), 'nes');

    const option = await screen.findByRole('option', { name: 'NestJS framework' });
    expect(within(option).getByText('NestJS')).toBeInTheDocument();
    expect(within(option).getByText('framework')).toHaveClass('text-text-muted', 'text-caption');
    expect(screen.getByText(SKILLS_FIELD_HINT)).toBeInTheDocument();
    expect(SKILLS_FIELD_HINT).toBe('Busque por nome ou apelido: “node”, “nodejs” e “Node.js” são a mesma skill.');
  });

  it('APP-59 finds a skill by an alias and offers its official name', async () => {
    render(<Harness api={fakeApi().api} />);

    typeInto(required(), 'nodejs');

    const option = await screen.findByRole('option', { name: 'Node.js ferramenta' });
    expect(within(option).getByText('Node.js')).toBeInTheDocument();
    expect(within(option).getByText('ferramenta')).toBeInTheDocument();
  });

  it('APP-59 turns the chosen suggestion into a removable tag with the official name and empties the field', async () => {
    render(<Harness api={fakeApi().api} />);

    typeInto(required(), 'nodejs');
    fireEvent.click(await screen.findByRole('option', { name: 'Node.js ferramenta' }));

    expect(removeButtons()).toEqual(['Remover Node.js']);
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(required()).toHaveValue('');
    expect(screen.queryByText(SKILLS_FIELD_HINT)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover Node.js' }));
    expect(removeButtons()).toEqual([]);
  });

  it('APP-59 does not offer a skill the field already has', async () => {
    const { api, searched } = fakeApi();
    render(<Harness api={api} initialRequired={[nest]} />);

    typeInto(required(), 'nestjs');
    // The same text in the other field does offer it, which tells the answer has arrived.
    typeInto(nice(), 'nestjs');
    expect(await screen.findByRole('option', { name: 'NestJS framework' })).toBeInTheDocument();
    await vi.waitFor(() => expect(searched).toEqual(['nestjs', 'nestjs']));

    // In the field that has NestJS no option is left: not the skill, and not "Criar" either.
    expect(optionNames()).toEqual(['NestJS framework']);
  });

  it('APP-60 offers to create a private skill when the text is not the official name of a suggestion', async () => {
    render(<Harness api={fakeApi().api} />);

    typeInto(required(), 'nes');

    const create = await screen.findByRole('option', { name: 'Criar “nes” como skill privada' });
    expect(create.querySelector('svg')).not.toBeNull();
    expect(optionNames()).toEqual(['NestJS framework', 'Criar “nes” como skill privada']);
  });

  it('APP-60 does not offer to create when the text is the official name of a suggestion, whatever the case', async () => {
    render(<Harness api={fakeApi().api} />);

    typeInto(required(), 'nEsTjS');

    expect(await screen.findByRole('option', { name: 'NestJS framework' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Criar/ })).not.toBeInTheDocument();
  });

  it('APP-60 swaps the menu for the seven categories, and one click creates the skill and adds it with the private mark', async () => {
    const { api, created } = fakeApi();
    render(<Harness api={api} />);

    typeInto(required(), 'Skill Fictícia Alfa');
    fireEvent.click(await screen.findByRole('option', { name: 'Criar “Skill Fictícia Alfa” como skill privada' }));

    expect(await screen.findAllByRole('option')).toHaveLength(7);
    expect(optionNames()).toEqual(['Linguagem', 'Framework', 'Banco de dados', 'Cloud/DevOps', 'Ferramenta', 'Prática', 'Soft skill']);
    expect(created).toEqual([]);

    fireEvent.click(screen.getByRole('option', { name: 'Prática' }));

    expect(created).toEqual([{ name: 'Skill Fictícia Alfa', category: 'practice' }]);
    expect(await screen.findByRole('button', { name: 'Remover Skill Fictícia Alfa' })).toBeInTheDocument();
    const tag = screen.getByText('Skill Fictícia Alfa').closest('span');
    expect(within(tag as HTMLElement).getByText('·')).toBeInTheDocument();
    expect(required()).toHaveValue('');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('APP-60 shows an error and adds nothing when the api refuses to create the skill', async () => {
    const { api } = fakeApi();
    const refusing: SkillsFieldApi = { ...api, create: () => Promise.resolve({ ok: false, status: 503 }) };
    render(<Harness api={refusing} />);

    typeInto(required(), 'Skill Fictícia Alfa');
    fireEvent.click(await screen.findByRole('option', { name: /Criar/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Linguagem' }));

    expect(await screen.findByText('Serviço indisponível. Tente novamente em instantes.')).toBeInTheDocument();
    expect(removeButtons()).toEqual([]);
  });

  it('APP-61 moves a skill that is in the other field to this one, without repeating it', async () => {
    const onChange = vi.fn();
    render(<Harness api={fakeApi().api} initialRequired={[node, react]} onChange={onChange} />);
    expect(removeButtons()).toEqual(['Remover Node.js', 'Remover React']);

    typeInto(nice(), 'node');
    fireEvent.click(await screen.findByRole('option', { name: 'Node.js ferramenta' }));

    const groups = screen.getAllByRole('combobox').map((box) => box.closest('div[class*="flex-wrap"]'));
    expect(within(groups[0] as HTMLElement).queryAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Remover React']);
    expect(within(groups[1] as HTMLElement).queryAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Remover Node.js']);
    expect(onChange).toHaveBeenLastCalledWith([react], [{ id: node.id, name: 'Node.js', scope: 'global' }]);
  });

  it('APP-61 moves a private skill too and keeps its private mark', async () => {
    const mine: Skill = { id: uuid(200), name: 'Skill Fictícia Alfa', category: 'tool', scope: 'private' };
    const { api } = fakeApi();
    const withMine: SkillsFieldApi = {
      ...api,
      search: (q) => Promise.resolve({ ok: true, data: [mine].filter((s) => normalizeSkillKey(s.name).includes(normalizeSkillKey(q))) }),
    };
    render(<Harness api={withMine} initialRequired={[mine]} />);

    typeInto(nice(), 'alfa');
    fireEvent.click(await screen.findByRole('option', { name: 'Skill Fictícia Alfa ferramenta' }));

    expect(removeButtons()).toEqual(['Remover Skill Fictícia Alfa']);
    const tag = screen.getByText('Skill Fictícia Alfa').closest('span');
    expect(within(tag as HTMLElement).getByText('·')).toBeInTheDocument();
  });
});
