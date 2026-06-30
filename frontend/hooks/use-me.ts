'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type {
  MeApiEnvelope,
  MeResponse,
} from '@/lib/types/api';

export const ME_QUERY_KEY = ['me'] as const;

/**
 * Hook do usuário autenticado + suas memberships.
 *
 * Endpoint: GET /api/v1/me — sem X-Organization-Id (skipOrgHeader: true).
 * Retorna shape achatado `{ user, memberships }` para ergonomia.
 *
 * staleTime 5min: `/me` muda raramente.
 */
export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const envelope = await apiFetch<MeApiEnvelope>('/api/v1/me', {
        skipOrgHeader: true,
      });
      return {
        user: envelope.data,
        memberships: envelope.memberships ?? [],
      };
    },
    staleTime: 5 * 60_000,
  });
}
