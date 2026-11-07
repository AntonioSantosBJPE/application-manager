import { Alert, AuthPage, Button } from '@am/ui';
import { MESSAGES } from '../model/messages';

/** A member on an admin page: the message and the way home, and nothing the admin area holds (UI-10). */
export function NoAccessScreen() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">{MESSAGES.noAccess}</h1>
      </AuthPage.Header>
      <Button asChild intent="secondary">
        <a href="/">Voltar para o início</a>
      </Button>
    </AuthPage.Root>
  );
}

/** The api did not answer while a guard asked for the session: say so, and keep the visitor where they are (UI-05). */
export function UnavailableScreen() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">Application Manager</h1>
      </AuthPage.Header>
      <Alert intent="danger">{MESSAGES.unavailable}</Alert>
    </AuthPage.Root>
  );
}
