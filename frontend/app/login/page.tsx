import { redirect } from 'next/navigation';

import { LoginCard } from './_components/LoginCard';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface LoginPageProps {
  searchParams: {
    error?: string | string[];
    invite?: string | string[];
  };
}

/**
 * Tela de login. Server Component.
 *
 * - Se já existe sessão e há `?invite=`, redireciona direto para
 *   `/invite/{token}` para retomar o fluxo de aceite.
 * - Caso contrário, sessão existente vai para `/me`.
 * - Sem sessão: renderiza o card propagando `error` e `invite`.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawInvite = searchParams.invite;
  const inviteToken = Array.isArray(rawInvite) ? rawInvite[0] : rawInvite;

  if (user) {
    if (inviteToken) {
      redirect(`/invite/${encodeURIComponent(inviteToken)}`);
    }
    redirect('/me');
  }

  const rawError = searchParams.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
      <LoginCard initialError={errorCode} inviteToken={inviteToken} />
    </main>
  );
}
