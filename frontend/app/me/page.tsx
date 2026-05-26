import { redirect } from 'next/navigation';

import { MeError } from './_components/MeError';
import { MeView, type MeProfile } from './_components/MeView';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type FetchResult =
  | { ok: true; profile: MeProfile }
  | { ok: false; message: string };

function isMeProfile(value: unknown): value is MeProfile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.provider === 'string' &&
    Array.isArray(v.providers) &&
    typeof v.created_at === 'string' &&
    (v.name === null || typeof v.name === 'string') &&
    (v.avatar_url === null || typeof v.avatar_url === 'string')
  );
}

async function fetchProfile(accessToken: string): Promise<FetchResult> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return {
      ok: false,
      message: 'Backend não configurado. Defina API_BASE_URL no servidor.',
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 401
            ? 'Sua sessão expirou. Atualize a página para entrar novamente.'
            : 'Não conseguimos carregar seus dados agora. Tente novamente em instantes.',
      };
    }

    const payload: unknown = await res.json();
    const data =
      typeof payload === 'object' && payload !== null
        ? (payload as { data?: unknown }).data
        : undefined;

    if (!isMeProfile(data)) {
      return {
        ok: false,
        message: 'Recebemos uma resposta inesperada do servidor.',
      };
    }

    return { ok: true, profile: data };
  } catch {
    return {
      ok: false,
      message: 'Não conseguimos falar com o servidor. Verifique sua conexão.',
    };
  }
}

/**
 * Página `/me`. Server Component.
 *
 * - Exige sessão Supabase; sem ela, redireciona para `/login`.
 * - Usa o `access_token` para chamar `GET /api/v1/me` no backend Laravel.
 * - Em erro de API, mostra estado amigável com botão de "Tentar novamente".
 */
export default async function MePage() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const result = await fetchProfile(session.access_token);

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {result.ok ? (
          <MeView profile={result.profile} />
        ) : (
          <MeError message={result.message} />
        )}
      </div>
    </main>
  );
}
