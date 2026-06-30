'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Organization, Paginated } from '@/lib/types/api';

export const ORGS_QUERY_KEY = ['organizations'] as const;

/**
 * Lista as orgs do usuário. NÃO envia X-Organization-Id (sem org ainda
 * resolvida — o backend sabe ler pela auth).
 *
 * Retorna apenas o array para uso direto em listas.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: ORGS_QUERY_KEY,
    queryFn: async (): Promise<Organization[]> => {
      const res = await apiFetch<Paginated<Organization>>(
        '/api/v1/organizations',
        { skipOrgHeader: true },
      );
      return res.data;
    },
    staleTime: 60_000,
  });
}
