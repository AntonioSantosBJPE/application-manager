import { BULLETS_PER_ITEM_MAX, BULLET_TEXT_MAX_LENGTH, type SkillDictionary } from '@am/contracts';
import { Button, DropdownMenu, Field } from '@am/ui';
import { useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { BulletSection } from '../api/server-functions';
import { type BulletsApi, useBulletWrites } from '../hooks/use-bullet-writes';
import type { SkillsFieldApi } from '../../skills';
import { BULLET_MESSAGES } from '../model/messages';
import type { CachedItemOf } from '../model/items';
import { BulletRow } from './BulletRow';
import { BulletSkills } from './BulletSkills';

export interface BulletListProps {
  section: BulletSection;
  item: CachedItemOf[BulletSection];
  skills: SkillDictionary;
  api: BulletsApi;
  /** The search and the creation of skills, for the field of skills of a bullet. */
  skillsApi: SkillsFieldApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** The empty field of a new bullet (RES-61, RES-63): `Enter` or leaving it with text writes it, `Esc` or leaving it empty drops it. */
function NewBullet({ onCreate, onClose }: { onCreate: (text: string) => Promise<boolean>; onClose: () => void }) {
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const settled = useRef(false);

  async function finish() {
    if (settled.current) return;
    const next = text.trim();
    if (next === '') {
      settled.current = true;
      onClose();
      return;
    }
    settled.current = true;
    if (await onCreate(next)) {
      onClose();
      return;
    }
    // The text stays in the field, and leaving it again tries again.
    settled.current = false;
    setFailure(BULLET_MESSAGES.saveFailed);
  }

  return (
    <Field.Root invalid={failure !== null} className="px-2">
      <div className="text-body-lg">
        <Field.Textarea
          aria-label={BULLET_MESSAGES.newText}
          autoFocus
          rows={1}
          maxLength={BULLET_TEXT_MAX_LENGTH}
          value={text}
          style={{ minHeight: 'var(--spacing-control-md)', resize: 'none', fontSize: 'inherit', lineHeight: 'inherit' }}
          className="field-sizing-content"
          onChange={(event) => setText(event.target.value.replace(/\r?\n/g, ' '))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void finish();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              settled.current = true;
              onClose();
            }
          }}
          onBlur={() => void finish()}
        />
      </div>
      <Field.Error>{failure}</Field.Error>
    </Field.Root>
  );
}

/**
 * The bullets of an experience or a project, in their saved order, with "+ Bullet" at the end (RES-60, RES-61,
 * RES-62, RES-83). "+ Bullet" opens an empty field with the focus; a bullet written there is created at the end
 * of the item. "+ Bullet" stops at 30.
 */
export function BulletList({ section, item, skills, api, skillsApi, onExpired }: BulletListProps) {
  const writes = useBulletWrites(section, item.id, api, onExpired);
  const [adding, setAdding] = useState(false);
  // The bullet whose field of skills is open: the one just created, or the one asked for in its menu (RES-62, RES-66).
  const [skillsFor, setSkillsFor] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {item.bullets.map((bullet) => (
        <BulletRow
          key={bullet.id}
          bullet={bullet}
          skills={skills}
          onText={async (text) => (await writes.update(bullet.id, { text })).ok}
          onDelete={async () => (await writes.remove(bullet.id)).ok}
          skillsOpen={skillsFor === bullet.id}
          onNoSkill={() => setSkillsFor(bullet.id)}
          menuItems={
            <DropdownMenu.Item onSelect={() => setSkillsFor(bullet.id)}>{BULLET_MESSAGES.editSkills}</DropdownMenu.Item>
          }
        >
          {skillsFor === bullet.id ? (
            <BulletSkills
              bullet={bullet}
              skills={skills}
              api={skillsApi}
              onSave={async (skillIds) => (await writes.update(bullet.id, { skillIds })).ok}
              onDone={() => setSkillsFor(null)}
            />
          ) : null}
        </BulletRow>
      ))}
      {adding ? (
        <NewBullet
          onCreate={async (text) => {
            const outcome = await writes.create({ text, skillIds: [] });
            if (outcome.ok) setSkillsFor(outcome.data.bullet.id);
            return outcome.ok;
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      <div>
        <Button
          intent="ghost"
          size="sm"
          disabled={item.bullets.length >= BULLETS_PER_ITEM_MAX}
          onClick={() => setAdding(true)}
        >
          {BULLET_MESSAGES.add}
        </Button>
      </div>
    </div>
  );
}
