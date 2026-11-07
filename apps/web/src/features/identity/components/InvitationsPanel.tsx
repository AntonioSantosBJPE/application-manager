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
  Field,
  ListPage,
  type CopyFieldStatus,
} from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { MESSAGES } from '../model/messages';

export const INVITATIONS_QUERY_KEY = ['identity', 'invitations'] as const;

const TEXT = {
  existingAccount: 'Este e-mail já tem uma conta.',
  copyFailed: 'Não foi possível copiar. Selecione o link.',
  linkOnce: 'Este link só aparece desta vez. Copie-o agora.',
  empty: 'Nenhum convite pendente.',
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
}

function totalText(total: number): string {
  return total === 1 ? '1 convite pendente' : `${total} convites pendentes`;
}

function Row({
  invitation,
  onRevoke,
}: {
  invitation: InvitationListItem;
  onRevoke: (invitation: InvitationListItem) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs">
      <span>{invitation.email}</span>
      <ConfirmDialog
        trigger={
          <Button
            intent="secondary"
            size="sm"
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
    </li>
  );
}

/**
 * The invitations screen (ADM-06..13): the form on top, the link of the invitation just created, and the
 * pending invitations below. Which invitations are pending, their order and the total are the api's
 * decision; the screen only shows what each page answers and asks for the next one.
 */
export function InvitationsPanel({ api, onExpired }: InvitationsPanelProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<string | undefined>();
  const [copyStatus, setCopyStatus] = useState<CopyFieldStatus>('idle');
  const [existingAccount, setExistingAccount] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

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
      try {
        outcome = await api.create({ email: emailSchema.parse(value.email) });
      } catch {
        setFailure(MESSAGES.unavailable);
        return;
      }
      if (outcome.ok) {
        setCreated(outcome.data.inviteUrl);
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
      await refresh();
      return;
    }
    if (!onExpired(outcome)) setFailure(MESSAGES.unavailable);
  }

  const pages = invitations.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const latest = pages.at(-1);

  return (
    <ListPage.Root>
      <ListPage.Header>
        <h1 className="text-lg font-semibold">Convites</h1>
        {latest === undefined ? null : (
          <span className="text-xs text-text-muted">{totalText(latest.totalPending)}</span>
        )}
      </ListPage.Header>
      <ListPage.Filters aria-label="Convidar pessoa">
        <form
          noValidate
          className="flex flex-wrap items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
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
              <Field.Root invalid={field.state.meta.errors.length > 0 || existingAccount}>
                <Field.Label htmlFor={`${id}-email`}>E-mail a convidar</Field.Label>
                <Field.Control
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
      <ListPage.Content>
        {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
        {created === undefined ? null : (
          <>
            <Alert intent="info">{TEXT.linkOnce}</Alert>
            <CopyField
              value={created}
              valueLabel="Link do convite"
              copyLabel="Copiar"
              copiedLabel="Copiado"
              failureMessage={TEXT.copyFailed}
              status={copyStatus}
              onCopy={() => void copyLink(created)}
            />
          </>
        )}
        {invitations.isError ? <Alert intent="danger">{MESSAGES.unavailable}</Alert> : null}
        {invitations.isPending ? (
          <p className="text-xs text-text-muted">Carregando convites…</p>
        ) : null}
        {invitations.isSuccess && items.length === 0 ? (
          <p className="text-xs text-text-muted">{TEXT.empty}</p>
        ) : null}
        {items.length > 0 ? (
          <ul aria-label="Convites pendentes" className="flex flex-col">
            {items.map((invitation) => (
              <Row
                key={invitation.id}
                invitation={invitation}
                onRevoke={(item) => void revoke(item)}
              />
            ))}
          </ul>
        ) : null}
        {invitations.hasNextPage ? (
          <Button
            intent="secondary"
            disabled={invitations.isFetchingNextPage}
            onClick={() => void invitations.fetchNextPage()}
          >
            Carregar mais
          </Button>
        ) : null}
      </ListPage.Content>
    </ListPage.Root>
  );
}
