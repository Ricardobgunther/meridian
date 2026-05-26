import { redirect } from 'next/navigation';

import { LoginCard } from './_components/LoginCard';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface LoginPageProps {
  searchParams: { error?: string | string[] };
}

/**
 * Tela de login. Server Component.
 *
 * - Se já existe sessão, redireciona para `/me`.
 * - Renderiza o card e propaga `?error=` para a faixa de erro acessível.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/me');
  }

  const rawError = searchParams.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
      <LoginCard initialError={errorCode} />
    </main>
  );
}
