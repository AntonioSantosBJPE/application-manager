import { Alert, AuthPage, Button } from '@am/ui';
import { CloudOff, Link2Off, LogOut, RefreshCw } from 'lucide-react';
import { MESSAGES } from '../model/messages';
import type { SessionMenuProps } from './SessionMenu';
import { useSignOut } from './use-sign-out';

function SignOutAction({ signOut, onSignedOut }: Pick<SessionMenuProps, 'signOut' | 'onSignedOut'>) {
  const { signingOut, failure, leave } = useSignOut({ signOut, onSignedOut });

  return (
    <>
      {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
      <Button intent="ghost" icon={LogOut} disabled={signingOut} onClick={leave}>
        Sair
      </Button>
    </>
  );
}

/**
 * A member on an admin page: the message and the way home, and nothing the admin area holds (UI-10).
 * With a session to hand, it also offers "Sair", the same action as the menu of the shell (UI-27).
 */
export function NoAccessScreen({ session }: { session?: SessionMenuProps }) {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Sem acesso</h1>
        <p className="text-text-muted">{MESSAGES.noAccess}</p>
      </AuthPage.Header>
      <div className="flex flex-col gap-2">
        <Button asChild intent="primary">
          <a href="/">Voltar para o início</a>
        </Button>
        {session === undefined ? null : (
          <SignOutAction signOut={session.signOut} onSignedOut={session.onSignedOut} />
        )}
      </div>
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
        <h1 className="text-heading-xl">Indisponível</h1>
      </AuthPage.Header>
      <Alert intent="danger" icon={CloudOff}>
        {MESSAGES.guardUnavailable}
      </Alert>
      <div>
        <Button intent="secondary" icon={RefreshCw} onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </AuthPage.Root>
  );
}

/** The only thing a dead invitation link shows: the message, and no form to fill in (UI-16). */
export function InvalidInvitationScreen() {
  return (
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Convite inválido</h1>
      </AuthPage.Header>
      <Alert intent="danger" icon={Link2Off}>
        {MESSAGES.invitationInvalid}
      </Alert>
    </AuthPage.Root>
  );
}
