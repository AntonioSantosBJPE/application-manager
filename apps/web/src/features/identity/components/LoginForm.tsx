import { loginRequestSchema, emailSchema, type LoginRequest } from '@am/contracts';
import { Alert, AuthPage, Button, Field } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import type { Outcome } from '../api/server-functions';
import { MESSAGES, problemMessage } from '../model/messages';

export interface LoginFormProps {
  title: string;
  /** The entrance this screen belongs to; the member and the admin forms differ only in this call. */
  login: (input: LoginRequest) => Promise<Outcome<undefined>>;
  /** Runs once the api accepted the credentials, so the route can open the preserved page (UI-01, UI-02). */
  onSuccess: () => void;
  /** A calm line above the fields, such as the expired-session notice (UI-08). */
  notice?: string;
}

/**
 * The sign-in form of both entrances (UI-01..05, UI-23). The api decides every outcome; this only
 * names it in the spec's words, keeps what the person typed and holds the button while a call is open.
 */
export function LoginForm({ title, login, onSuccess, notice }: LoginFormProps) {
  const id = useId();
  const [failure, setFailure] = useState<string | undefined>();
  // After a success the route is already navigating; keeping the button off stops a second submit.
  const [signedIn, setSignedIn] = useState(false);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setFailure(undefined);
      let outcome: Outcome<undefined>;
      try {
        outcome = await login(loginRequestSchema.parse(value));
      } catch {
        // The server function itself did not answer, which is as unavailable as the api being down (UI-05).
        setFailure(MESSAGES.unavailable);
        return;
      }
      if (!outcome.ok) {
        setFailure(problemMessage(outcome));
        return;
      }
      setSignedIn(true);
      onSuccess();
    },
  });

  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">{title}</h1>
      </AuthPage.Header>
      <AuthPage.Form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {notice === undefined ? null : <Alert intent="info">{notice}</Alert>}
        {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
        <form.Field
          name="email"
          validators={{
            onSubmit: ({ value }) =>
              emailSchema.safeParse(value).success ? undefined : 'Informe um e-mail válido.',
          }}
        >
          {(field) => (
            <Field.Root invalid={field.state.meta.errors.length > 0}>
              <Field.Label htmlFor={`${id}-email`}>E-mail</Field.Label>
              <Field.Control
                id={`${id}-email`}
                type="email"
                autoComplete="username"
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
            onSubmit: ({ value }) => (value === '' ? 'Informe a senha.' : undefined),
          }}
        >
          {(field) => (
            <Field.Root invalid={field.state.meta.errors.length > 0}>
              <Field.Label htmlFor={`${id}-password`}>Senha</Field.Label>
              <Field.Control
                id={`${id}-password`}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
            </Field.Root>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" intent="primary" disabled={isSubmitting || signedIn}>
              Entrar
            </Button>
          )}
        </form.Subscribe>
      </AuthPage.Form>
    </AuthPage.Root>
  );
}
