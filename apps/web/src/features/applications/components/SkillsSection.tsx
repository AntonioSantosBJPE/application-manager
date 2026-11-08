import type { PostingSkill, ReplaceSkillsRequest } from '@am/contracts';
import { Button, SkillTag } from '@am/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { SkillsField, type SkillsFieldApi, type SkillsFieldSkill } from '../../skills';
import { DETAIL_MESSAGES } from '../model/messages';

type Requirement = 'required' | 'nice';

export interface SkillsSectionProps {
  skills: readonly PostingSkill[];
  /** Writes the whole list, in the order to keep: the required ones, then the nice to have ones (APP-73). */
  onChange: (body: ReplaceSkillsRequest) => void;
  api: SkillsFieldApi;
}

/** The body of the `PUT`: required first, nice to have after, each list in the order on screen. */
function bodyOf(required: readonly { id: string }[], nice: readonly { id: string }[]): ReplaceSkillsRequest {
  return [
    ...required.map((skill) => ({ skillId: skill.id, requirement: 'required' as const })),
    ...nice.map((skill) => ({ skillId: skill.id, requirement: 'nice_to_have' as const })),
  ];
}

/**
 * "Skills da vaga" (APP-73): the skills of each requirement as tags, each with a "×", and the "+ Skill"
 * of each row, which opens the same field as the registration dialog (search by name or alias, create a
 * private skill). The change is written as the whole list; a skill picked in the row it is not in moves
 * to this one and is never repeated.
 */
export function SkillsSection({ skills, onChange, api }: SkillsSectionProps) {
  const [adding, setAdding] = useState<Requirement | null>(null);
  const required = skills.filter((skill) => skill.requirement === 'required');
  const nice = skills.filter((skill) => skill.requirement === 'nice_to_have');
  const rows: { requirement: Requirement; label: string; addLabel: string; list: readonly PostingSkill[] }[] = [
    { requirement: 'required', label: DETAIL_MESSAGES.required, addLabel: DETAIL_MESSAGES.addRequired, list: required },
    { requirement: 'nice', label: DETAIL_MESSAGES.nice, addLabel: DETAIL_MESSAGES.addNice, list: nice },
  ];

  function remove(skillId: string) {
    onChange(
      bodyOf(
        required.filter((skill) => skill.id !== skillId),
        nice.filter((skill) => skill.id !== skillId),
      ),
    );
  }

  function add(requirement: Requirement, picked: SkillsFieldSkill) {
    const others = (list: readonly PostingSkill[]) => list.filter((skill) => skill.id !== picked.id);
    onChange(
      requirement === 'required'
        ? bodyOf([...others(required), picked], others(nice))
        : bodyOf(others(required), [...others(nice), picked]),
    );
    setAdding(null);
  }

  return (
    <section aria-labelledby="detail-skills" className="flex flex-col gap-3">
      <h2 id="detail-skills" className="text-heading-sm">
        {DETAIL_MESSAGES.skills}
      </h2>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.requirement} className="flex items-start gap-3">
            <span className="w-22 shrink-0 pt-0.5 text-label text-text-muted">{row.label}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ul aria-label={row.label} className="flex flex-wrap items-center gap-1.5">
                  {row.list.map((skill) => (
                    <li key={skill.id}>
                      <SkillTag
                        variant={skill.scope === 'private' ? 'private' : row.requirement}
                        onRemove={() => remove(skill.id)}
                        removeLabel={`Remover ${skill.name}`}
                      >
                        {skill.name}
                      </SkillTag>
                    </li>
                  ))}
                </ul>
                {adding === row.requirement ? null : (
                  <Button
                    intent="ghost"
                    size="sm"
                    icon={Plus}
                    aria-label={row.addLabel}
                    className="h-5.5 border-dashed border-border-strong"
                    onClick={() => setAdding(row.requirement)}
                  >
                    {DETAIL_MESSAGES.addSkill}
                  </Button>
                )}
              </div>
              {adding === row.requirement ? (
                <div
                  className="flex items-start gap-1"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && !event.defaultPrevented) setAdding(null);
                  }}
                >
                  <SkillsField
                    className="flex-1"
                    label={row.addLabel}
                    requirement={row.requirement}
                    skills={[]}
                    api={api}
                    placeholder={DETAIL_MESSAGES.skillsPlaceholder}
                    onChange={([picked]) => {
                      if (picked !== undefined) add(row.requirement, picked);
                    }}
                  />
                  <Button
                    intent="ghost"
                    size="sm"
                    icon={X}
                    aria-label={DETAIL_MESSAGES.cancelAddSkill}
                    className="mt-5"
                    onClick={() => setAdding(null)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

