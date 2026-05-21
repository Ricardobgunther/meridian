# Skill: Supabase Patterns

## Quando Usar
Qualquer trabalho com Supabase: auth, banco, storage, realtime, edge functions.

## Configuração de Clientes

```typescript
// lib/supabase/client.ts — browser client (componentes cliente)
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// lib/supabase/server.ts — server client (Server Components, Route Handlers)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// lib/supabase/service.ts — service role (apenas no servidor, com poderes de admin)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NUNCA expor ao cliente
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

## Autenticação — Padrões

```typescript
// Auth com email/password
async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);
  return data.user;
}

// Auth com OAuth (Google, GitHub)
async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

// Middleware de proteção de rotas — middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
};
```

## Queries Tipadas com Supabase JS

```typescript
// Tipos gerados automaticamente (rodar: supabase gen types typescript --local > types/database.types.ts)
import type { Database } from '@/types/database.types';
type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];

// Query com tipagem completa
async function getUserInvoices(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, number, status, total_amount, due_date, created_at,
      client:clients ( id, name, email )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
  return data;
}

// Insert com retorno
async function createInvoice(payload: InvoiceInsert) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .insert(payload)
    .select('*, client:clients(*), items:invoice_items(*)')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Update parcial com verificação de ownership (RLS garante, mas validar também)
async function updateInvoiceStatus(id: string, status: Invoice['status']) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Invoice not found or access denied');
  return data;
}
```

## Realtime — Subscriptions

```typescript
// Hook customizado para realtime
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useInvoiceRealtime(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`invoices:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'invoices',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Invalidar cache do TanStack Query para refetch
          queryClient.invalidateQueries({ queryKey: ['invoices', userId] });

          // Para updates pontuais, fazer patch otimista
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) =>
              old?.map((inv) =>
                inv.id === payload.new.id ? { ...inv, ...payload.new } : inv
              ) ?? []
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);
}
```

## Storage — Upload de Arquivos

```typescript
// Padrão de upload com validação
async function uploadInvoicePdf(file: File, invoiceId: string): Promise<string> {
  // Validação antes do upload
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['application/pdf'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Apenas arquivos PDF são permitidos');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Arquivo muito grande. Máximo 10MB.');
  }

  const supabase = createClient();
  const filePath = `invoices/${invoiceId}/invoice.pdf`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // URL pública assinada (expira em 1 hora)
  const { data: signedUrl } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600);

  return signedUrl?.signedUrl ?? '';
}
```

## RLS — Testando Policies

```sql
-- Testar como usuário autenticado específico
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';

-- Verificar se o select respeita RLS
SELECT * FROM invoices; -- deve retornar apenas as do user
SELECT * FROM invoices WHERE user_id != 'user-uuid-here'; -- deve retornar vazio

-- Testar insert com user errado
INSERT INTO invoices (user_id, ...) VALUES ('outro-user-id', ...); -- deve falhar
```

## Edge Functions — Quando Usar

```typescript
// supabase/functions/send-invoice-email/index.ts
// Usar Edge Functions para: webhooks externos, cron jobs, operações que precisam de secrets

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req: Request) => {
  const { invoice_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*)')
    .eq('id', invoice_id)
    .single();

  if (!invoice) {
    return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 });
  }

  // Enviar email via Resend ou similar
  await sendEmail({ to: invoice.client.email, invoice });
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice_id);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

## Anti-Patterns Supabase
- Usar `service_role_key` no cliente (browser)
- `select('*')` sem especificar colunas necessárias
- Tabelas sem RLS habilitado
- Subscriptions realtime sem cleanup (`removeChannel`)
- Queries sem tratamento de erro
- URLs de storage públicas para documentos sensíveis (usar `createSignedUrl`)
