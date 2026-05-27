'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { ThemeBoot } from './ThemeBoot';
import type { ApiError } from '@/lib/types/api';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Cliente TanStack Query com defaults globais.
 *
 * - Não retentamos em 4xx (exceto 408 e 429) porque são erros do cliente.
 * - Mutations nunca fazem retry — UX fica imprevisível com double-submits.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: 'always',
        retry: (failureCount, error) => {
          const apiErr = error as Partial<ApiError> | undefined;
          const status = apiErr?.status;
          if (
            typeof status === 'number' &&
            status >= 400 &&
            status < 500 &&
            status !== 408 &&
            status !== 429
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Providers globais do app:
 * - QueryClientProvider (cache de servidor)
 * - ThemeBoot (aplica data-theme em <html> reagindo ao store)
 * - Toaster (sonner — top-right desktop, top-center mobile)
 *
 * Mantenha leve. Não acoplar lógica de domínio aqui.
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Lazy-init em useState para garantir um único client por sessão.
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeBoot />
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          // sonner usa role="status" / "alert" internamente; classNames acessíveis.
          className: 'font-sans text-sm',
        }}
      />
    </QueryClientProvider>
  );
}
