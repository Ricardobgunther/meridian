'use client';

import { useMe } from './use-me';
import { useOrganization } from './use-organization';
import type { Membership, Organization, Role } from '@/lib/types/api';

interface UseActiveOrgResult {
  /** Membership do usuário nesta org (contém o slug original e role). */
  membership: Membership | null;
  /** Organização completa (com settings, timestamps). */
  organization: Organization | null;
  /** Role do usuário na org ou null se não for membro. */
  role: Role | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Resolve a org ativa por slug a partir de `useMe()`, depois carrega o
 * recurso completo via `useOrganization(id)`. Mantém um único ponto de
 * verdade para "qual org estou olhando agora".
 */
export function useActiveOrg(slug: string): UseActiveOrgResult {
  const meQuery = useMe();
  const membership =
    meQuery.data?.memberships.find((m) => m.organization.slug === slug) ?? null;
  const orgQuery = useOrganization(membership?.organization.id ?? null);

  return {
    membership,
    organization: orgQuery.data ?? null,
    role: membership?.role ?? null,
    isLoading: meQuery.isPending || orgQuery.isPending,
    isError: meQuery.isError || orgQuery.isError,
    refetch: () => {
      void meQuery.refetch();
      void orgQuery.refetch();
    },
  };
}
