import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { updateSession } from '@/lib/supabase/middleware';
import type { Database } from '@/lib/supabase/types';

/**
 * Middleware do Next.js.
 *
 * 1. Renova a sessão Supabase via `updateSession` (cookies SSR).
 * 2. Aplica gates de rota:
 *    - `/me*` exige usuário autenticado; sem sessão → redireciona para `/login`.
 *    - `/login` autenticado → redireciona para `/me` (evita ver tela de login logado).
 *
 * Importante: NÃO altere a lógica de `updateSession`. A leitura do usuário aqui usa
 * o mesmo padrão SSR só para decidir o redirect — o response com cookies atualizados
 * vindo de `updateSession` é preservado nos casos em que não redirecionamos.
 */
export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Não escrever cookies aqui — updateSession já cuidou disso.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const protectedPrefixes = ['/me', '/dashboard', '/org', '/settings'];
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    // Preserva o fluxo de convite — se o usuário aterrissou em
    // `/login?invite=...` já autenticado, mandamos direto para a página de
    // aceite em vez de descartar o token e ir para o dashboard.
    if (inviteToken) {
      url.pathname = `/invite/${inviteToken}`;
    } else {
      url.pathname = '/dashboard';
    }
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Casa todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico e assets de fontes
     * - arquivos com extensão de imagem comum
     */
    '/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
