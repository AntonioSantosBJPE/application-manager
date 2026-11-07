import {
  acceptInvitationRequestSchema,
  nameSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  type AcceptInvitationRequest,
  type InvitationDetails,
} from '@am/contracts';
import { Alert, AuthPage, Button, Field } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { MESSAGES, problemMessage } from '../model/messages';
import { UnavailableScreen } from './AccessScreens';

export interface AcceptInvitationFormProps {
  /** What `GET /invitations/:token` answered when the page opened. */
  invitation: Outcome<InvitationDetails>;
  accept: (input: AcceptInvitationRequest) => Promise<Outcome<undefined>>;
  /** Runs once the account exists and the session started, so the route opens the home (UI-15). */
  onSuccess: () => void;
}

/** The only thing a dead link shows: the message, and no form to fill in (UI-16). */
function InvalidInvitation() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">Convite</h1>
      </AuthPage.Header>
      <Alert intent="danger">{MESSAGES.invitationInvalid}</Alert>
    </AuthPage.Root>
  );
}

/**
 * The invitation screen (UI-14..16, UI-23): the invited email is shown, never edited, beside the name
 * and the password with its length rule. A `410`, when the page opens or when the form is sent, turns
 * the screen into the invalid message; the api decides which links are still good.
 */
export function AcceptInvitationForm({ invitation, accept, onSuccess }: AcceptInvitationFormProps) {
  const id = useId();
  const [expired, setExpired] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [accepted, setAccepted] = useState(false);

  const form = useForm({
    defaultValues: { name: '', password: '' },
    onSubmit: async ({ value }) => {
      setFailure(undefined);
      let outcome: Outcome<undefined>;
      try {
        outcome = await accept(acceptInvitationRequestSchema.parse(value));
      } catch {
        setFailure(MESSAGES.unavailable);
        return;
      }
      if (outcome.ok) {
        setAccepted(true);
        onSuccess();
        return;
      }
      if (outcome.status === 410) {
        setExpired(true);
        return;
      }
      setFailure(problemMessage(outcome));
    },
  });

  if (!invitation.ok) {
    return invitation.status === 410 ? <InvalidInvitation /> : <UnavailableScreen />;
  }
  if (expired) return <InvalidInvitation />;

  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">Criar conta</h1>
      </AuthPage.Header>
      <AuthPage.Form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
        <Field.Root>
          <Field.Label htmlFor={`${id}-email`}>E-mail</Field.Label>
          <Field.Control id={`${id}-email`} type="email" readOnly value={invitation.data.email} />
        </Field.Root>
        <form.Field
          name="name"
          validators={{
            onSubmit: ({ value }) =>
              nameSchema.safeParse(value).success
                ? undefined
                : 'Informe seu nome, com até 120 caracteres.',
          }}
        >
          {(field) => (
            <Field.Root invalid={field.state.meta.errors.length > 0}>
              <Field.Label htmlFor={`${id}-name`}>Nome</Field.Label>
              <Field.Control
                id={`${id}-name`}
                autoComplete="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
            </Field.Root>
          )}
        </form.Field>
        <form.Field
          name="password"
          validators={{
            onSubmit: ({ value }) =>
              passwordSchema.safeParse(value).success
                ? undefined
                : `A senha precisa ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`,
          }}
        >
          {(field) => (
            <Field.Root invalid={field.state.meta.errors.length > 0}>
              <Field.Label htmlFor={`${id}-password`}>Senha</Field.Label>
              <Field.Control
                id={`${id}-password`}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <Field.Hint>{`Use de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`}</Field.Hint>
              <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
            </Field.Root>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" intent="primary" disabled={isSubmitting || accepted}>
              Criar conta
            </Button>
          )}
        </form.Subscribe>
      </AuthPage.Form>
    </AuthPage.Root>
  );
}
