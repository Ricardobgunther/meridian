import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Landing pública mínima do starter.
 *
 * - Usuário autenticado → `/dashboard` (entra direto no shell).
 * - Usuário visitante → CTAs para login.
 *
 * Mantém o app sem uma marketing page rica de propósito — produtos que
 * forkarem o starter substituem este arquivo.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface px-4">
      <section className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Projeto1
        </h1>
        <p className="text-sm text-text-muted">
          Starter SaaS com Next.js, Laravel e Supabase. Faça login para
          continuar.
        </p>
        <a
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors duration-fast ease-standard hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
        >
          Entrar
        </a>
      </section>
    </main>
  );
}
