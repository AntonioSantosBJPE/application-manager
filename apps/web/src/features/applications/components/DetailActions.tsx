import type { ApplicationDetail, ReplaceSkillsRequest, UpdateJobPostingRequest } from '@am/contracts';
import { Button, DropdownMenu } from '@am/ui';
import { Ellipsis } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { SkillsFieldApi, SkillsFieldSkill } from '../../skills';
import { DETAIL_MESSAGES } from '../model/messages';
import { ApplicationFormDialog, type ApplicationChanges, type ApplicationFormValues } from './ApplicationFormDialog';

export interface DetailActionsProps {
  application: ApplicationDetail;
  api: {
    updatePosting: (id: string, body: UpdateJobPostingRequest) => Promise<Outcome<ApplicationDetail>>;
    replaceSkills: (id: string, body: ReplaceSkillsRequest) => Promise<Outcome<ApplicationDetail>>;
    skills: SkillsFieldApi;
  };
  /** The application as the api answered a step of the edit, so the page behind the dialog shows it. */
  onUpdated: (application: ApplicationDetail) => void;
  /** Opens the confirmation to delete, the same one as the button of the sidebar (APP-75). */
  onDelete: () => void;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

const skillOf = (skill: ApplicationDetail['skills'][number]): SkillsFieldSkill => ({
  id: skill.id,
  name: skill.name,
  scope: skill.scope,
});

/** What the dialog opens with: the posting as it is now, with its skills in the two lists (APP-74). */
function valuesOf(application: ApplicationDetail): Partial<ApplicationFormValues> {
  return {
    company: application.company,
    title: application.title,
    url: application.url ?? '',
    level: application.level,
    workModel: application.workModel,
    required: application.skills.filter((skill) => skill.requirement === 'required').map(skillOf),
    nice: application.skills.filter((skill) => skill.requirement === 'nice_to_have').map(skillOf),
    description: application.description ?? '',
  };
}

/**
 * The "⋯" of the topbar (APP-74, APP-75): "Editar vaga" opens the registration dialog filled with the
 * posting, which saves with a `PATCH` of the changed fields and a `PUT` of the skills when they changed;
 * "Excluir candidatura" opens the same confirmation as the sidebar button.
 */
export function DetailActions({ application, api, onUpdated, onDelete, onExpired }: DetailActionsProps) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Choosing "Excluir candidatura" hands the focus to the confirmation, not back to the "⋯".
  const keepFocus = useRef(false);

  async function update({ posting, skills }: ApplicationChanges): Promise<Outcome<ApplicationDetail>> {
    let last: Outcome<ApplicationDetail> | undefined;
    if (posting !== undefined) {
      last = await api.updatePosting(application.id, posting);
      if (!last.ok) return last;
      onUpdated(last.data);
    }
    if (skills !== undefined) {
      last = await api.replaceSkills(application.id, skills);
      if (!last.ok) return last;
      onUpdated(last.data);
    }
    return last ?? { ok: true, data: application };
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button ref={trigger} intent="ghost" size="sm" icon={Ellipsis} aria-label={DETAIL_MESSAGES.moreActions} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="end"
          onCloseAutoFocus={(event) => {
            if (!keepFocus.current) return;
            keepFocus.current = false;
            event.preventDefault();
          }}
        >
          <DropdownMenu.Item onSelect={() => setEditing(true)}>{DETAIL_MESSAGES.editJob}</DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              keepFocus.current = true;
              onDelete();
            }}
          >
            {DETAIL_MESSAGES.delete}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {editing ? (
        <ApplicationFormDialog
          mode="edit"
          initial={valuesOf(application)}
          api={{ skills: api.skills }}
          update={update}
          onSaved={onUpdated}
          onClose={() => setEditing(false)}
          onExpired={onExpired}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
