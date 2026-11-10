import type { MasterResume, ResumeSection } from '@am/contracts';
import { Button, ConfirmDialog } from '@am/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { RESUME_QUERY_KEY } from '../hooks/resume-query-key';
import type { ItemsApi } from '../hooks/use-item-form';
import { DELETE_DIALOG, RESUME_MESSAGES } from '../model/messages';
import { DELETE_ITEM_DESCRIPTIONS, DELETE_ITEM_LABELS, DELETE_ITEM_TITLES } from '../model/sections';

export interface DeleteItemProps {
  section: ResumeSection;
  id: string;
  api: ItemsApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/**
 * "Excluir {item}" (RES-57, RES-58): the button in the fields of an item and the `ConfirmDialog`
 * "Excluir {item}?" it opens, with "Excluir" in `danger`. Nothing is sent until the person confirms; the
 * item then leaves the cache, and with it its number in the index and its bullets in the warning.
 */
export function DeleteItem({ section, id, api, onExpired }: DeleteItemProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  async function remove() {
    setFailure(null);
    let outcome: Outcome<undefined>;
    try {
      outcome = await api.deleteItem(section, id);
    } catch {
      outcome = { ok: false, status: 503 };
    }
    if (outcome.ok) {
      queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, (resume) =>
        resume === undefined
          ? resume
          : { ...resume, [section]: (resume[section] as { id: string }[]).filter((item) => item.id !== id) },
      );
      return;
    }
    if (!onExpired(outcome)) setFailure(RESUME_MESSAGES.deleteFailed);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <ConfirmDialog
        trigger={
          <Button intent="ghost" size="sm" icon={Trash2} className="justify-start text-danger! hover:text-danger!">
            {DELETE_ITEM_LABELS[section]}
          </Button>
        }
        title={DELETE_ITEM_TITLES[section]}
        description={DELETE_ITEM_DESCRIPTIONS[section]}
        confirmLabel={DELETE_DIALOG.confirm}
        cancelLabel={DELETE_DIALOG.cancel}
        confirmIntent="danger"
        onConfirm={remove}
      />
      {failure === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
