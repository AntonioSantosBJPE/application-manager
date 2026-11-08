import { Button, ConfirmDialog } from '@am/ui';
import { Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import { DETAIL_MESSAGES } from '../model/messages';

export interface DeleteApplicationProps {
  company: string;
  /** Deletes the application; the dialog stays open until it settles. Telling a failure is the caller's job. */
  onConfirm: () => Promise<unknown>;
  /** The button that opens the dialog: the "⋯" menu opens it by clicking this one (APP-75). */
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * "Excluir candidatura" (APP-75): the button at the foot of the sidebar and the `ConfirmDialog`
 * "Excluir candidatura?" it opens, with "Excluir" in `danger`. The deletion is for good, so nothing is
 * deleted until the person confirms.
 */
export function DeleteApplication({ company, onConfirm, buttonRef }: DeleteApplicationProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button ref={buttonRef} intent="ghost" size="sm" icon={Trash2} className="justify-start text-danger! hover:text-danger!">
          {DETAIL_MESSAGES.delete}
        </Button>
      }
      title={DETAIL_MESSAGES.deleteTitle}
      description={DETAIL_MESSAGES.deleteDescription(company)}
      confirmLabel={DETAIL_MESSAGES.deleteConfirm}
      cancelLabel={DETAIL_MESSAGES.deleteCancel}
      confirmIntent="danger"
      onConfirm={onConfirm}
    />
  );
}
