import type { AdminSkill, Alias, AliasRequest } from '@am/contracts';
import { Alert, Button, ConfirmDialog, Dialog } from '@am/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';
import { aliasesTitle, REMOVE_ALIAS_DESCRIPTION, removeAliasTitle, SKILLS_MESSAGES } from '../model/messages';
import { AliasInput } from './AliasInput';
import { focusWhenConfirmationClosed } from './focus';

export interface AliasesDialogProps {
  /** The skill as the catalog holds it now, so an alias saved or removed shows here at once (SKL-75, SKL-76). */
  skill: AdminSkill;
  onAdd: (body: AliasRequest) => Promise<Outcome<Alias>>;
  onUpdate: (aliasId: string, body: AliasRequest) => Promise<Outcome<Alias>>;
  onRemove: (aliasId: string) => Promise<Outcome<undefined>>;
  onClose: () => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** Where the focus goes once the dialog closes; the catalog sends it back to the row menu. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * "Apelidos de {nome}" (SKL-74..SKL-76): each alias of the skill with "Editar" (the text becomes a field in
 * place) and "Remover" (a confirmation first), and a field to add another. A skill with no alias says so.
 */
export function AliasesDialog({
  skill,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
  onExpired,
  onCloseAutoFocus,
}: AliasesDialogProps) {
  const id = useId();
  const newAliasId = `${id}-new`;
  const [editing, setEditing] = useState<string | undefined>();
  const [failure, setFailure] = useState(false);
  const leftEdit = useRef<string | undefined>(undefined);
  const list = useRef<HTMLUListElement>(null);

  // Leaving the edit gives the focus back to the "Editar" of that alias, which the field had replaced.
  useEffect(() => {
    if (editing !== undefined || leftEdit.current === undefined) return;
    const aliasId = leftEdit.current;
    leftEdit.current = undefined;
    Array.from(list.current?.querySelectorAll<HTMLElement>('[data-alias-id]') ?? [])
      .find((item) => item.dataset.aliasId === aliasId)
      ?.querySelector<HTMLElement>('[data-alias-edit]')
      ?.focus();
  }, [editing]);

  function stopEditing(aliasId: string) {
    leftEdit.current = aliasId;
    setEditing(undefined);
  }

  async function remove(alias: Alias) {
    setFailure(false);
    let outcome: Outcome<undefined>;
    try {
      outcome = await onRemove(alias.id);
    } catch {
      setFailure(true);
      return;
    }
    // A `404` means the alias is already gone, which is what was asked for.
    if (outcome.ok || outcome.status === 404) {
      focusWhenConfirmationClosed(() => document.getElementById(newAliasId));
      return;
    }
    if (!onExpired(outcome)) setFailure(true);
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <Dialog.Title>{aliasesTitle(skill.name)}</Dialog.Title>
        {skill.aliases.length === 0 ? (
          <p className="text-body text-text-muted">{SKILLS_MESSAGES.noAliasesInDialog}</p>
        ) : (
          <ul ref={list} aria-label={SKILLS_MESSAGES.aliases} className="flex flex-col">
            {skill.aliases.map((alias) => (
              <li
                key={alias.id}
                data-alias-id={alias.id}
                className="flex min-h-row flex-wrap items-center justify-between gap-2 border-b border-border py-1.5"
              >
                {editing === alias.id ? (
                  <div className="min-w-0 flex-1">
                    <AliasInput
                      label="Apelido"
                      labelHidden
                      autoFocus
                      initial={alias.alias}
                      submitLabel={SKILLS_MESSAGES.save}
                      onSubmit={(body) => onUpdate(alias.id, body)}
                      onSaved={() => stopEditing(alias.id)}
                      onCancel={() => stopEditing(alias.id)}
                      onExpired={onExpired}
                    />
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 truncate">{alias.alias}</span>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        intent="ghost"
                        size="sm"
                        data-alias-edit=""
                        onClick={() => {
                          setFailure(false);
                          setEditing(alias.id);
                        }}
                      >
                        {SKILLS_MESSAGES.edit}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button intent="ghost" size="sm">
                            {SKILLS_MESSAGES.remove}
                          </Button>
                        }
                        title={removeAliasTitle(alias.alias)}
                        description={REMOVE_ALIAS_DESCRIPTION}
                        confirmLabel={SKILLS_MESSAGES.remove}
                        cancelLabel={SKILLS_MESSAGES.cancel}
                        onConfirm={() => remove(alias)}
                      />
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {failure ? <Alert intent="danger">{MESSAGES.unavailable}</Alert> : null}
        <AliasInput
          label="Novo apelido"
          controlId={newAliasId}
          submitLabel="Adicionar"
          onSubmit={onAdd}
          onSaved={() => setFailure(false)}
          onExpired={onExpired}
        />
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button intent="secondary">Fechar</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
