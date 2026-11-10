import type { Bullet, SkillDictionary } from '@am/contracts';
import { Button } from '@am/ui';
import { useRef, useState } from 'react';
import { SkillsField, type SkillsFieldApi, type SkillsFieldSkill } from '../../skills';
import { BULLET_MESSAGES } from '../model/messages';

export interface BulletSkillsProps {
  bullet: Bullet;
  /** Every skill the resume cites, to name the skills the bullet already has. */
  skills: SkillDictionary;
  api: SkillsFieldApi;
  /** Writes the whole list of skill ids; answers whether it was saved (RES-67). */
  onSave: (skillIds: string[]) => Promise<boolean>;
  /** "Concluir": closes the field. */
  onDone: () => void;
}

const namedIn = (skillIds: string[], skills: SkillDictionary): SkillsFieldSkill[] =>
  skillIds.flatMap((id) => (skills[id] === undefined ? [] : [{ id, ...skills[id] }]));

/**
 * The field of skills of a bullet, below its text (RES-66, RES-67): the same `SkillsField` as the job
 * posting, with the search of the catalog and "Criar … como skill privada". Each inclusion or removal saves
 * the bullet at once, one write after the other, and a write that fails puts the list back to the last
 * saved one. "Concluir" closes the field.
 */
export function BulletSkills({ bullet, skills, api, onSave, onDone }: BulletSkillsProps) {
  const [selected, setSelected] = useState(() => namedIn(bullet.skillIds, skills));
  const [failure, setFailure] = useState<string | null>(null);
  const lastSaved = useRef(selected);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function change(next: SkillsFieldSkill[]) {
    setSelected(next);
    setFailure(null);
    queue.current = queue.current.then(async () => {
      if (await onSave(next.map((skill) => skill.id))) {
        lastSaved.current = next;
      } else {
        setSelected(lastSaved.current);
        setFailure(BULLET_MESSAGES.saveFailed);
      }
    });
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      <SkillsField label={BULLET_MESSAGES.skillsLabel} requirement="required" skills={selected} onChange={(next) => change(next)} api={api} />
      {failure === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {failure}
        </p>
      )}
      <div>
        <Button intent="secondary" size="sm" onClick={onDone}>
          {BULLET_MESSAGES.done}
        </Button>
      </div>
    </div>
  );
}
