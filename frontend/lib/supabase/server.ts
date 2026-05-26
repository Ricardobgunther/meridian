import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from './types';

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 *
 * Importante: deve ser criado por requisição — não armazene em variável global.
 * Em Server Components o `setAll` pode falhar (cookies são read-only); o try/catch
 * é intencional para esses casos, em que o refresh acontece via middleware.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: ignorar com segurança quando
            // o middleware estiver atualizando a sessão a cada requisição.
          }
        },
      },
    },
  );
}
