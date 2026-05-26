import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from './types';

/**
 * Atualiza/renova o token Supabase a cada requisição.
 *
 * Padrão recomendado pelo @supabase/ssr para Next.js 14 App Router:
 * - Crie sempre um novo client por request (não armazene globalmente).
 * - Não execute código entre createServerClient e supabase.auth.getUser().
 * - Retorne o objeto supabaseResponse para manter os cookies em sincronia
 *   entre browser e servidor.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não remover. Esta chamada refresca o token quando preciso.
  await supabase.auth.getUser();

  return supabaseResponse;
}
