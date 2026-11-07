import { createFileRoute, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { adminLogin, LoginForm, safeRedirect } from '../../features/identity';

/** Admin entrance (UI-02): the same form on its own door, because admin and member accounts are separate (AD-005). */
export const Route = createFileRoute('/admin/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();

  return (
    <LoginForm
      title="Administração"
      login={(data) => adminLogin({ data })}
      onSuccess={() => router.history.push(safeRedirect(redirect, '/admin'))}
    />
  );
}
