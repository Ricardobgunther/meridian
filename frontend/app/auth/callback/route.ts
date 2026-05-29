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
  // Fluxo de convite: quando o link vem da página /invite/[token], o
  // `signInWithOAuth` propaga `invite=<token>` via redirectTo. Aqui
  // priorizamos o convite sobre o `next` padrão, garantindo que o usuário
  // volte para a tela de aceite logo após o OAuth — caso contrário ele
  // cairia em /me e perderia o contexto.
  const inviteToken = searchParams.get('invite');
  const next = searchParams.get('next') ?? '/me';

  // Erro vindo do próprio provider (ex.: usuário cancelou o consentimento).
  const providerError = searchParams.get('error');
  if (providerError) {
    const code =
      providerError === 'access_denied' ? 'access_denied' : 'oauth_failed';
    const target = inviteToken
      ? `${origin}/login?error=${code}&invite=${encodeURIComponent(inviteToken)}`
      : `${origin}/login?error=${code}`;
    return NextResponse.redirect(target);
  }

  if (!code) {
    const target = inviteToken
      ? `${origin}/login?error=oauth_failed&invite=${encodeURIComponent(inviteToken)}`
      : `${origin}/login?error=oauth_failed`;
    return NextResponse.redirect(target);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = inviteToken
      ? `${origin}/login?error=oauth_failed&invite=${encodeURIComponent(inviteToken)}`
      : `${origin}/login?error=oauth_failed`;
    return NextResponse.redirect(target);
  }

  // `next` precisa ser um path relativo para evitar open-redirect.
  const safeNext = next.startsWith('/') ? next : '/me';
  // Token de convite sobrescreve `next` — ver comentário acima.
  const finalTarget = inviteToken
    ? `/invite/${encodeURIComponent(inviteToken)}`
    : safeNext;
  return NextResponse.redirect(`${origin}${finalTarget}`);
}
