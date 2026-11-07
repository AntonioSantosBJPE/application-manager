import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import {
  adminLogin,
  getSession,
  LoginForm,
  MESSAGES,
  safeRedirect,
  signedInHome,
} from '../../features/identity';

/** Admin entrance (UI-02): the same form on its own door, because admin and member accounts are separate (AD-005). */
export const Route = createFileRoute('/admin/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    reason: z.literal('expired').optional(),
  }),
  beforeLoad: async () => {
    const home = signedInHome(await getSession(), 'admin');
    if (home === '/admin') throw redirect({ to: '/admin' });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { redirect: returnTo, reason } = Route.useSearch();
  const router = useRouter();

  return (
    <LoginForm
      title="Administração"
      notice={reason === 'expired' ? MESSAGES.sessionExpired : undefined}
      login={(data) => adminLogin({ data })}
      onSuccess={() => router.history.push(safeRedirect(returnTo, '/admin'))}
    />
  );
}
