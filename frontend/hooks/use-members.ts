'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type {
  Membership,
  Paginated,
  Role,
} from '@/lib/types/api';

export interface MembersFilters {
  page?: number;
  q?: string;
  role?: Role | 'all';
  perPage?: number;
}

export function membersQueryKey(orgId: string, filters: MembersFilters = {}) {
  return [
    'organization',
    orgId,
    'members',
    {
      page: filters.page ?? 1,
      q: filters.q ?? '',
      role: filters.role ?? 'all',
      perPage: filters.perPage ?? 20,
    },
  ] as const;
}

/**
 * Hook paginado para membros da org. Mantém dados anteriores entre páginas
 * (keepPreviousData) para evitar flicker durante navegação/filtros.
 */
export function useMembers(
  orgId: string | null | undefined,
  filters: MembersFilters = {},
) {
  return useQuery({
    queryKey: membersQueryKey(orgId ?? 'none', filters),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Paginated<Membership>> => {
      const query: Record<string, string | number | undefined> = {
        page: filters.page ?? 1,
        per_page: filters.perPage ?? 20,
      };
      if (filters.q) query.q = filters.q;
      if (filters.role && filters.role !== 'all') query.role = filters.role;
      return apiFetch<Paginated<Membership>>(
        `/api/v1/organizations/${orgId}/members`,
        { query },
      );
    },
    staleTime: 30_000,
  });
}
