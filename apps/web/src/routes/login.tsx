import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import {
  getSession,
  LoginForm,
  MESSAGES,
  memberLogin,
  safeRedirect,
  signedInHome,
} from '../features/identity';

/**
 * Member entrance (UI-01). `redirect` is the page the visitor was after, trusted only as an internal path
 * (UI-09); `reason=expired` comes from an action that found the session over (UI-08). A member who is
 * already signed in goes to the home instead of seeing the form (UI-12).
 */
export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    reason: z.literal('expired').optional(),
  }),
  beforeLoad: async () => {
    const home = signedInHome(await getSession(), 'member');
    if (home === '/') throw redirect({ to: '/' });
  },
  component: MemberLoginPage,
});

function MemberLoginPage() {
  const { redirect: returnTo, reason } = Route.useSearch();
  const router = useRouter();

  return (
    <LoginForm
      title="Entrar"
      notice={reason === 'expired' ? MESSAGES.sessionExpired : undefined}
      login={(data) => memberLogin({ data })}
      onSuccess={() => router.history.push(safeRedirect(returnTo, '/'))}
    />
  );
}
