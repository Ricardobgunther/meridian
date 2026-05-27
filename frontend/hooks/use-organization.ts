'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Organization, SingleResource } from '@/lib/types/api';

export function organizationQueryKey(orgId: string) {
  return ['organization', orgId] as const;
}

/**
 * Carrega uma org específica. O backend aceita o ID por URL OU header — aqui
 * usamos o ID na URL e deixamos o middleware bater contra o header também.
 */
export function useOrganization(orgId: string | null | undefined) {
  return useQuery({
    queryKey: organizationQueryKey(orgId ?? 'none'),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Organization> => {
      const res = await apiFetch<SingleResource<Organization>>(
        `/api/v1/organizations/${orgId}`,
      );
      return res.data;
    },
    staleTime: 60_000,
  });
}
