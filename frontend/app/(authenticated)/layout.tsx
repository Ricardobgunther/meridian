import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';
import { Shell } from './_components/Shell';

/**
 * Server Component que gateia o grupo (authenticated).
 *
 * - Sem sessão → redirect /login.
 * - Com sessão → monta <Shell> que carrega `/me` via TanStack Query.
 *
 * O grupo `(authenticated)` não aparece na URL — é só para co-locar
 * rotas protegidas debaixo do mesmo shell.
 */
export const dynamic = 'force-dynamic';

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthenticatedLayout({
  children,
}: AuthLayoutProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <Shell>{children}</Shell>;
}
