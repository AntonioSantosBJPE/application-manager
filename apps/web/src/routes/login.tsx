import { createFileRoute, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginForm, memberLogin, safeRedirect } from '../features/identity';

/** Member entrance (UI-01): `redirect` is the page the visitor was after, and is trusted only as an internal path (UI-09). */
export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: MemberLoginPage,
});

function MemberLoginPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();

  return (
    <LoginForm
      title="Entrar"
      login={(data) => memberLogin({ data })}
      onSuccess={() => router.history.push(safeRedirect(redirect, '/'))}
    />
  );
}
