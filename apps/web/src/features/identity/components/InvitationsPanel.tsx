import {
  emailSchema,
  type CreateInvitationRequest,
  type CreateInvitationResponse,
  type InvitationListItem,
  type InvitationsPage,
} from '@am/contracts';
import {
  Alert,
  Button,
  ConfirmDialog,
  CopyField,
  EmptyState,
  Field,
  ListPage,
  PipelineStatus,
  type CopyFieldStatus,
} from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { daysLeft, isUrgent } from '../model/expiry';
import { MESSAGES } from '../model/messages';

export const INVITATIONS_QUERY_KEY = ['identity', 'invitations'] as const;

const TEXT = {
  existingAccount: 'Este e-mail já tem uma conta.',
  copyFailed: 'Não foi possível copiar. Selecione o link.',
  linkOnce: '· este link só aparece desta vez. Copie-o agora.',
  empty: 'Nenhum convite pendente.',
  emptyAction: 'Convidar pessoa',
} as const;

/** What the panel needs from the BFF; the route binds the server functions, a test binds the api. */
export interface InvitationsApi {
  list: (cursor: string | undefined) => Promise<Outcome<InvitationsPage>>;
  create: (input: CreateInvitationRequest) => Promise<Outcome<CreateInvitationResponse>>;
  revoke: (id: string) => Promise<Outcome<undefined>>;
}

export interface InvitationsPanelProps {
  api: InvitationsApi;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening (UI-08). */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** The clock the expiry of each row is counted from; a test fixes it. */
  now?: () => Date;
}

/** Where the focus goes once the list changes: a row that is not there yet, or the title of the list. */
type PendingFocus =
  | { kind: 'first-new-row'; after: number }
  | { kind: 'row'; id: string; revoked: string }
  | { kind: 'title'; revoked: string };

function totalText(total: number): string {
  return total === 1 ? '1 pendente' : `${total} pendentes`;
}

function Row({
  invitation,
  now,
  onRevoke,
}: {
  invitation: InvitationListItem;
  now: Date;
  onRevoke: (invitation: InvitationListItem) => void;
}) {
  const days = daysLeft(invitation.expiresAt, now);

  return (
    <ListPage.Row data-invitation-id={invitation.id} tabIndex={-1} className="outline-none">
      <ListPage.RowText>{invitation.email}</ListPage.RowText>
      <ListPage.RowMeta>
        {days === undefined ? null : (
          <span
            className={
              isUrgent(days)
                ? 'w-24 text-right font-mono text-caption text-warning'
                : 'w-24 text-right font-mono text-caption'
            }
          >
            expira em {days} d
          </span>
        )}
        <ConfirmDialog
          trigger={
            <Button
              intent="ghost"
              size="sm"
              className="shrink-0"
              aria-label={`Revogar convite de ${invitation.email}`}
            >
              Revogar
            </Button>
          }
          title="Revogar convite"
          description={`O link enviado para ${invitation.email} deixa de funcionar.`}
          confirmLabel="Revogar"
          cancelLabel="Cancelar"
          onConfirm={() => onRevoke(invitation)}
        />
      </ListPage.RowMeta>
    </ListPage.Row>
  );
}

/**
 * The invitations screen (ADM-06..13, PRU-06 AC16..19, AC24): the title with the pending count, the form
 * in the filter row, the link of the invitation just created on a strip of its own, and the pending
 * invitations in the group "Pendentes", each with the days left until it expires. Which invitations are
 * pending, their order and the total are the api's decision; the screen only shows what each page
 * answers and asks for the next one.
 */
export function InvitationsPanel({
  api,
  onExpired,
  now = () => new Date(),
}: InvitationsPanelProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<{ url: string; email: string } | undefined>();
  const [copyStatus, setCopyStatus] = useState<CopyFieldStatus>('idle');
  const [existingAccount, setExistingAccount] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const titleRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<PendingFocus | undefined>(undefined);

  const invitations = useInfiniteQuery({
    queryKey: INVITATIONS_QUERY_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const outcome = await api.list(pageParam);
      if (outcome.ok) return outcome.data;
      onExpired(outcome);
      throw new Error(`invitations answered ${outcome.status}`);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY });

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value, formApi }) => {
      setFailure(undefined);
      setExistingAccount(false);
      let outcome: Outcome<CreateInvitationResponse>;
      let email: string;
      try {
        email = emailSchema.parse(value.email);
        outcome = await api.create({ email });
      } catch {
        setFailure(MESSAGES.unavailable);
        return;
      }
      if (outcome.ok) {
        setCreated({ url: outcome.data.inviteUrl, email });
        setCopyStatus('idle');
        formApi.reset();
        await refresh();
        return;
      }
      if (onExpired(outcome)) return;
      if (outcome.status === 409) setExistingAccount(true);
      else setFailure(MESSAGES.unavailable);
    },
  });

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  async function revoke(invitation: InvitationListItem) {
    setFailure(undefined);
    let outcome: Outcome<undefined>;
    try {
      outcome = await api.revoke(invitation.id);
    } catch {
      setFailure(MESSAGES.unavailable);
      return;
    }
    if (outcome.ok || outcome.status === 404) {
      // A `404` means someone already revoked it: the list should simply stop showing it.
      const index = items.findIndex((item) => item.id === invitation.id);
      const next = items[index + 1];
      pendingFocus.current = next
        ? { kind: 'row', id: next.id, revoked: invitation.id }
        : { kind: 'title', revoked: invitation.id };
      await refresh();
      return;
    }
    if (!onExpired(outcome)) setFailure(MESSAGES.unavailable);
  }

  const pages = invitations.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const latest = pages.at(-1);

  // The focus follows the list (UI-26): a row that appears or disappears must not leave it on the body.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === undefined) return;
    const rowOf = (rowId: string) =>
      Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-invitation-id]') ?? []).find(
        (row) => row.dataset.invitationId === rowId,
      );
    let target: HTMLElement | null | undefined;
    if (pending.kind === 'first-new-row') {
      if (items.length <= pending.after) return;
      target = rowOf(items[pending.after]!.id);
    } else {
      if (items.some((item) => item.id === pending.revoked)) return;
      target = pending.kind === 'row' ? rowOf(pending.id) : titleRef.current;
    }
    pendingFocus.current = undefined;
    (target ?? titleRef.current)?.focus();
  }, [items]);

  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1 ref={titleRef} tabIndex={-1} className="outline-none">
          Convites
        </h1>
        {latest === undefined ? null : (
          <span className="font-mono text-caption font-normal text-text-muted">
            {totalText(latest.totalPending)}
          </span>
        )}
      </ListPage.Header>
      <ListPage.Filters aria-label="Convidar pessoa" className="py-3">
        <form
          noValidate
          className="flex w-full flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            // Enter in the field or a second submit event must not start a second invitation: it would
            // revoke the link the first one just returned.
            if (form.state.isSubmitting) return;
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="email"
            validators={{
              onSubmit: ({ value }) =>
                emailSchema.safeParse(value).success ? undefined : 'Informe um e-mail válido.',
            }}
          >
            {(field) => (
              <Field.Root
                invalid={field.state.meta.errors.length > 0 || existingAccount}
                className="w-full sm:w-80"
              >
                <Field.Label htmlFor={`${id}-email`}>E-mail a convidar</Field.Label>
                <Field.Control
                  ref={emailRef}
                  id={`${id}-email`}
                  type="email"
                  autoComplete="off"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    setExistingAccount(false);
                    field.handleChange(event.target.value);
                  }}
                />
                <Field.Error>
                  {existingAccount
                    ? TEXT.existingAccount
                    : field.state.meta.errors.map(String).join(' ')}
                </Field.Error>
              </Field.Root>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" intent="primary" disabled={isSubmitting} className="mt-5">
                Convidar
              </Button>
            )}
          </form.Subscribe>
        </form>
      </ListPage.Filters>
      {created === undefined ? null : (
        <div className="flex flex-col gap-2 border-b border-border bg-surface-raised px-6 py-4">
          <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PipelineStatus status="accepted" label="Criado" iconOnly aria-hidden />
            <span className="min-w-0 font-medium break-all">
              Convite criado para {created.email}
            </span>
            <span className="text-caption text-text-muted">{TEXT.linkOnce}</span>
          </p>
          <CopyField
            className="max-w-160"
            value={created.url}
            valueLabel="Link do convite"
            copyLabel="Copiar"
            copiedLabel="Copiado"
            failureMessage={TEXT.copyFailed}
            status={copyStatus}
            onCopy={() => void copyLink(created.url)}
          />
        </div>
      )}
      <ListPage.Content>
        {failure === undefined ? null : (
          <Alert intent="danger" className="mx-6 mt-4">
            {failure}
          </Alert>
        )}
        {invitations.isError ? (
          <Alert intent="danger" className="mx-6 mt-4">
            {MESSAGES.unavailable}
          </Alert>
        ) : null}
        {invitations.isPending ? (
          <p className="px-6 py-4 text-caption text-text-muted">Carregando convites…</p>
        ) : null}
        {invitations.isSuccess && items.length === 0 ? (
          <EmptyState.Root className="mx-6 mt-4">
            <p>{TEXT.empty}</p>
            <EmptyState.Action>
              <Button intent="secondary" size="sm" onClick={() => emailRef.current?.focus()}>
                {TEXT.emptyAction}
              </Button>
            </EmptyState.Action>
          </EmptyState.Root>
        ) : null}
        {items.length > 0 ? (
          <>
            <ListPage.Group count={latest?.totalPending}>Pendentes</ListPage.Group>
            <ul ref={listRef} aria-label="Convites pendentes" className="flex flex-col">
              {items.map((invitation) => (
                <Row
                  key={invitation.id}
                  invitation={invitation}
                  now={now()}
                  onRevoke={(item) => void revoke(item)}
                />
              ))}
            </ul>
          </>
        ) : null}
        {invitations.hasNextPage ? (
          <div className="px-6 py-4">
            <Button
              intent="secondary"
              disabled={invitations.isFetchingNextPage}
              onClick={() => {
                pendingFocus.current = { kind: 'first-new-row', after: items.length };
                void invitations.fetchNextPage();
              }}
            >
              Carregar mais
            </Button>
          </div>
        ) : null}
      </ListPage.Content>
    </ListPage.Root>
  );
}
