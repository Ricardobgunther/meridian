'use client';

import { useMe } from './use-me';
import { useOrganization } from './use-organization';
import { getCurrentOrgId } from '@/lib/org/current';
import type { Membership, Organization, Role } from '@/lib/types/api';

export interface UseCurrentOrgResult {
  /** Id da org ativa resolvida contra as memberships. */
  orgId: string | null;
  /** Membership do usuário na org ativa (role + slug). */
  membership: Membership | null;
  /** Organização completa (nome, created_at) via useOrganization. */
  organization: Organization | null;
  role: Role | null;
  /** `me` pendente OU (org resolvida E query da org pendente). */
  isLoading: boolean;
  /** Erro da query da org (erros de `me` são tratados pelo Shell). */
  isError: boolean;
  refetch: () => void;
}

/**
 * Resolve a org ativa para páginas sem segmento `[slug]` (ex.: /dashboard).
 *
 * Leitura-espelho de `resolveCurrentOrgId`: storage válido → usa; senão a
 * primeira membership. NÃO escreve em storage — o Shell é o único writer
 * (spec 05 §8); o fallback read-only garante o mesmo resultado que o Shell
 * persistirá, mesmo no primeiro paint antes do effect dele rodar.
 */
export function useCurrentOrg(): UseCurrentOrgResult {
  const meQuery = useMe();
  const memberships = meQuery.data?.memberships ?? [];
  const stored = getCurrentOrgId();

  const membership =
    memberships.find((m) => m.organization.id === stored) ??
    memberships[0] ??
    null;
  const orgId = membership?.organization.id ?? null;
  const orgQuery = useOrganization(orgId);

  return {
    orgId,
    membership,
    organization: orgQuery.data ?? null,
    role: membership?.role ?? null,
    isLoading: meQuery.isPending || (orgId !== null && orgQuery.isPending),
    isError: orgQuery.isError,
    refetch: () => {
      void orgQuery.refetch();
    },
  };
}
