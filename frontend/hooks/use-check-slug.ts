'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { isValidSlug } from '@/lib/utils/string';
import type { SlugCheckResponse, SlugCheckStatus } from '@/lib/types/api';

import { useDebouncedValue } from './use-debounced-value';

export function slugCheckQueryKey(slug: string) {
  return ['slug-check', slug] as const;
}

/**
 * Verificação advisory de disponibilidade de slug (create-org modal).
 *
 * - Debounce de 400ms; cada tecla invalida o veredito anterior na hora.
 * - Só consulta slugs que passam no padrão client-side (3–60, kebab-case).
 * - Falha (rede/5xx/429) degrada em silêncio para `idle` — nunca bloqueia
 *   o submit nem alarma o usuário (overview J4).
 * - Cache de 30s por slug; o 422 do POST /organizations sobrescreve a
 *   entrada via `slugCheckQueryKey` (ver use-create-org).
 *
 * Endpoint: GET /api/v1/organizations/check-slug — auth, sem tenant
 * context (`skipOrgHeader: true`).
 */
export function useCheckSlug(rawSlug: string): { status: SlugCheckStatus } {
  const slug = rawSlug.trim();
  const valid = slug.length >= 3 && slug.length <= 60 && isValidSlug(slug);
  const debounced = useDebouncedValue(slug, 400);
  // Só habilita quando o debounce alcançou o valor atual — evita exibir
  // veredito de uma string que o usuário já abandonou.
  const settled = debounced === slug;

  const query = useQuery({
    queryKey: slugCheckQueryKey(debounced),
    enabled: valid && settled,
    staleTime: 30_000,
    retry: false, // advisory — nunca insistir
    queryFn: ({ signal }) =>
      apiFetch<SlugCheckResponse>('/api/v1/organizations/check-slug', {
        query: { slug: debounced },
        skipOrgHeader: true,
        signal,
      }),
  });

  if (!valid) return { status: 'idle' };
  if (!settled || query.isPending) return { status: 'checking' };
  if (query.isError || !query.data) return { status: 'idle' };
  return { status: query.data.data.available ? 'available' : 'taken' };
}
