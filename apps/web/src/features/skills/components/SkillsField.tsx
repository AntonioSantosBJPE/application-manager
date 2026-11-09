import { SKILL_TEXT_MAX_LENGTH, type CreateSkillRequest, type Skill, type SkillCategory } from '@am/contracts';
import { Field, TagField, type ComboboxOption } from '@am/ui';
import { Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { problemMessage, type Failure } from '../../identity';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../model/categories';

/** What the field keeps of a skill: enough to draw its tag and to send its id. */
export type SkillsFieldSkill = Pick<Skill, 'id' | 'name' | 'scope'>;

/** What the field needs from the BFF; a screen binds the server functions, a test binds the api. */
export interface SkillsFieldApi {
  search: (q: string) => Promise<Outcome<Skill[]>>;
  create: (body: CreateSkillRequest) => Promise<Outcome<Skill>>;
}

export interface SkillsFieldProps {
  /** The visible name of the field ("Skills obrigatórias"). */
  label: string;
  /** How the global skills of this field are drawn: solid for the required ones, dashed for the nice to have. */
  requirement: 'required' | 'nice';
  /** The skills of this field, in the order they were added. */
  skills: readonly SkillsFieldSkill[];
  /** The skills of the other skills field, so a skill picked here that is there is moved, not repeated (APP-61). */
  other?: readonly SkillsFieldSkill[];
  /** Called with this field's skills and the other field's skills after every change; the other list only differs after a move. */
  onChange: (skills: SkillsFieldSkill[], other: SkillsFieldSkill[]) => void;
  api: SkillsFieldApi;
  placeholder?: string;
  className?: string;
  /** The line shown when creating a private skill fails; the default names only the unavailable service. */
  failureMessage?: (failure: Failure) => string;
}

/** The note under the field while the person types (APP-59). */
export const SKILLS_FIELD_HINT = 'Busque por nome ou apelido: “node”, “nodejs” e “Node.js” são a mesma skill.';

const SKILL_PREFIX = 'skill:';
const CREATE_ID = 'create';
const CATEGORY_PREFIX = 'category:';

const createLabel = (text: string) => `Criar “${text}” como skill privada`;
const sameName = (a: string, b: string) => a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR');

/**
 * A field of skills (APP-59..APP-61): the person types a name or an alias, the api answers with the
 * skills that match and the field offers them with their official name and category. A text that is not
 * the official name of any of them can become a private skill: choosing "Criar … como skill privada"
 * swaps the menu for the seven categories, and one click on a category creates the skill and adds it
 * with the private mark. A skill that is already in the other field is moved here, never repeated.
 *
 * The field is controlled and holds nothing but the text and the menu. To keep both fields consistent in
 * one step, `onChange` receives the two lists together: pass the pair back to wherever the form keeps them.
 */
export function SkillsField({
  label,
  requirement,
  skills,
  other = [],
  onChange,
  api,
  placeholder,
  className,
  failureMessage = problemMessage,
}: SkillsFieldProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  // The skills found for `for`; the create option waits for the answer of the text on screen.
  const [found, setFound] = useState<{ for: string; skills: Skill[] } | null>(null);
  // The name of the private skill being made while the menu shows the categories.
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Choosing "Criar …" makes the tag field empty the text, as it does after any choice; the name must stay.
  const keepText = useRef(false);
  const creating = useRef(false);
  // The menu is controlled: choosing "Criar …" closes it, as any choice does, and it has to stay open with the categories.
  const [open, setOpen] = useState(false);
  const keepOpen = useRef(false);

  useEffect(() => {
    // With no text there is nothing to look for; the answer kept from before no longer matches `query`.
    if (pending !== null || query.trim() === '') return;
    let stale = false;
    void api.search(query).then((outcome) => {
      if (!stale) setFound({ for: query, skills: outcome.ok ? outcome.data : [] });
    });
    return () => {
      stale = true;
    };
  }, [api, query, pending]);

  const ownIds = new Set(skills.map((skill) => skill.id));
  const settled = found !== null && found.for === query ? found.skills : null;
  const text = query.trim();

  let options: ComboboxOption[] = [];
  if (pending !== null) {
    options = CATEGORY_ORDER.map((category) => ({ id: `${CATEGORY_PREFIX}${category}`, label: CATEGORY_LABELS[category] }));
  } else if (settled !== null) {
    options = settled
      .filter((skill) => !ownIds.has(skill.id))
      .map((skill) => ({ id: `${SKILL_PREFIX}${skill.id}`, label: skill.name, hint: CATEGORY_LABELS[skill.category].toLocaleLowerCase('pt-BR') }));
    if (text !== '' && !settled.some((skill) => sameName(skill.name, text))) {
      options.push({ id: CREATE_ID, label: createLabel(text), icon: Plus });
    }
  }

  function add(skill: SkillsFieldSkill) {
    const without = (list: readonly SkillsFieldSkill[]) => list.filter((item) => item.id !== skill.id);
    onChange([...without(skills), { id: skill.id, name: skill.name, scope: skill.scope }], without(other));
    setQuery('');
    setPending(null);
    setOpen(false);
  }

  async function createPrivate(name: string, category: SkillCategory) {
    if (creating.current) return;
    creating.current = true;
    const outcome = await api.create({ name, category });
    creating.current = false;
    if (outcome.ok) add(outcome.data);
    else {
      setFailure(failureMessage(outcome));
      setPending(null);
      setOpen(false);
    }
  }

  function handleSelect(option: ComboboxOption) {
    if (option.id === CREATE_ID) {
      keepText.current = true;
      keepOpen.current = true;
      setPending(text);
      setOpen(true);
    } else if (option.id.startsWith(CATEGORY_PREFIX) && pending !== null) {
      void createPrivate(pending, option.id.slice(CATEGORY_PREFIX.length) as SkillCategory);
    } else {
      const skill = settled?.find((item) => `${SKILL_PREFIX}${item.id}` === option.id);
      if (skill !== undefined) add(skill);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && keepOpen.current) {
      keepOpen.current = false;
      return;
    }
    setOpen(next);
  }

  function handleQueryChange(next: string) {
    if (keepText.current && next === '') {
      keepText.current = false;
      return;
    }
    setQuery(next);
    setPending(null);
    setFailure(null);
  }

  return (
    <Field.Root invalid={failure !== null} className={className}>
      <Field.Label htmlFor={id}>{label}</Field.Label>
      <TagField
        id={id}
        activateFirst
        tags={skills.map((skill) => ({
          id: skill.id,
          label: skill.name,
          variant: skill.scope === 'private' ? 'private' : requirement === 'required' ? 'required' : 'nice',
          removeLabel: `Remover ${skill.name}`,
        }))}
        onRemove={(skillId) => onChange(skills.filter((skill) => skill.id !== skillId), [...other])}
        query={query}
        onQueryChange={handleQueryChange}
        options={options}
        onSelect={handleSelect}
        open={open}
        onOpenChange={handleOpenChange}
        placeholder={placeholder}
        maxLength={SKILL_TEXT_MAX_LENGTH}
      />
      {query !== '' ? <Field.Hint>{SKILLS_FIELD_HINT}</Field.Hint> : null}
      <Field.Error>{failure}</Field.Error>
    </Field.Root>
  );
}
