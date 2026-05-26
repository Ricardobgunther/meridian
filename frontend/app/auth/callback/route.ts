import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Callback do OAuth (Google/GitHub) Supabase.
 *
 * Fluxo:
 * 1. Recebe `?code=...` retornado pelo provider via Supabase.
 * 2. Troca o code pela sessão (`exchangeCodeForSession`) — cookies SSR ficam
 *    populados pelo cliente criado em `lib/supabase/server.ts`.
 * 3. Redireciona para `next` (default `/me`) em caso de sucesso,
 *    ou para `/login?error=<code>` quando algo falha.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/me';

  // Erro vindo do próprio provider (ex.: usuário cancelou o consentimento).
  const providerError = searchParams.get('error');
  if (providerError) {
    const code =
      providerError === 'access_denied' ? 'access_denied' : 'oauth_failed';
    return NextResponse.redirect(`${origin}/login?error=${code}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  // `next` precisa ser um path relativo para evitar open-redirect.
  const safeNext = next.startsWith('/') ? next : '/me';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
