import { Alert, AuthPage, Button } from '@am/ui';
import { MESSAGES } from '../model/messages';
import { SessionMenu, type SessionMenuProps } from './SessionMenu';

/**
 * A member on an admin page: the message and the way home, and nothing the admin area holds (UI-10).
 * With a session to hand, it also offers "Sair", the same action as the menu of the shell (UI-27).
 */
export function NoAccessScreen({ session }: { session?: SessionMenuProps }) {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">{MESSAGES.noAccess}</h1>
      </AuthPage.Header>
      <Button asChild intent="secondary">
        <a href="/">Voltar para o início</a>
      </Button>
      {session === undefined ? null : <SessionMenu {...session} />}
    </AuthPage.Root>
  );
}

/**
 * The api did not answer while a guard asked for the session: say so, keep the visitor where they are
 * (UI-05) and offer "Tentar novamente", which reloads the route (UI-27).
 */
export function UnavailableScreen({
  onRetry = () => window.location.reload(),
}: {
  onRetry?: () => void;
}) {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-lg font-semibold">Application Manager</h1>
      </AuthPage.Header>
      <Alert intent="danger">{MESSAGES.unavailable}</Alert>
      <Button intent="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </AuthPage.Root>
  );
}
