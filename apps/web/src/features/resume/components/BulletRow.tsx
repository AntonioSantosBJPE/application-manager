import { BULLET_TEXT_MAX_LENGTH, type Bullet as BulletData, type SkillDictionary } from '@am/contracts';
import { Bullet, Button, DropdownMenu, InlineEdit, SkillTag } from '@am/ui';
import { Ellipsis } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BULLET_MESSAGES } from '../model/messages';

export interface BulletRowProps {
  bullet: BulletData;
  /** Every skill the resume cites, by id; the tags below the text are read from it (AD-028). */
  skills: SkillDictionary;
  /** Writes the new text; the row shows the text the cache holds, so a failure leaves the old one (RES-64). */
  onText: (text: string) => Promise<boolean>;
  /** Removes the bullet, with no confirmation (RES-68). */
  onDelete: () => Promise<boolean>;
  /** The grip that moves the bullet, a `Sortable.Handle` (RES-71). */
  handle?: ReactNode;
  /** What goes under the text and the tags, such as the field of skills (RES-66). */
  children?: ReactNode;
  /** Extra items of the "⋯" menu, before "Excluir bullet". */
  menuItems?: ReactNode;
  /** Makes the notice "sem skill" a button that opens the skills field (RES-66). */
  onNoSkill?: () => void;
}

/**
 * A bullet of an experience or project (RES-60, RES-64, RES-65, RES-68, RES-69): the text in `body-lg`, edited
 * where it stands, its skills as tags below, "sem skill" in `warning` when it has none, and the "⋯" menu
 * that shows under the pointer or the focus, also on a bullet with no skill.
 */
export function BulletRow({ bullet, skills, onText, onDelete, handle, children, menuItems, onNoSkill }: BulletRowProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const tags = bullet.skillIds.flatMap((id) => (skills[id] === undefined ? [] : [{ id, ...skills[id] }]));

  async function commitText(text: string) {
    const next = text.trim();
    // An empty text is not accepted: the row goes back to the old one and nothing is sent (RES-65).
    if (next === '' || next === bullet.text) return;
    setFailure(null);
    if (!(await onText(next))) setFailure(BULLET_MESSAGES.saveFailed);
  }

  async function remove() {
    setFailure(null);
    if (!(await onDelete())) setFailure(BULLET_MESSAGES.deleteFailed);
  }

  const menu = (
    <Bullet.Actions>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button intent="ghost" size="sm" icon={Ellipsis} aria-label={BULLET_MESSAGES.actions} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          {menuItems}
          <DropdownMenu.Item onSelect={() => void remove()}>{BULLET_MESSAGES.delete}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Bullet.Actions>
  );

  return (
    <Bullet.Root
      handle={handle}
      aside={
        <div className="flex items-center gap-1">
          {tags.length === 0 ? (
            onNoSkill === undefined ? (
              <Bullet.Notice>{BULLET_MESSAGES.noSkill}</Bullet.Notice>
            ) : (
              <Button intent="ghost" size="sm" className="text-warning!" onClick={onNoSkill}>
                <Bullet.Notice>{BULLET_MESSAGES.noSkill}</Bullet.Notice>
              </Button>
            )
          ) : null}
          {menu}
        </div>
      }
    >
      <div className="text-body-lg">
        <InlineEdit
          multiline
          label={BULLET_MESSAGES.editText}
          value={bullet.text}
          maxLength={BULLET_TEXT_MAX_LENGTH}
          className="px-0!"
          onCommit={(text) => void commitText(text)}
        />
      </div>
      <Bullet.Tags>
        {tags.map((skill) => (
          <SkillTag key={skill.id} variant={skill.scope === 'private' ? 'private' : 'required'}>
            {skill.name}
          </SkillTag>
        ))}
      </Bullet.Tags>
      {children}
      {failure === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {failure}
        </p>
      )}
    </Bullet.Root>
  );
}
