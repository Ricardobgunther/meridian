'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { InvitationsListResponse } from '@/lib/types/api';

export function invitationsQueryKey(orgId: string) {
  return ['invitations', orgId] as const;
}

/**
 * Lista convites da org ativa (paginado pelo backend; UI assume single-page).
 * Refetch automático on-focus pelo default do QueryClient.
 *
 * Endpoint: GET /api/v1/invitations — exige `X-Organization-Id`.
 */
export function useInvitations(orgId: string | null | undefined) {
  return useQuery<InvitationsListResponse>({
    queryKey: invitationsQueryKey(orgId ?? 'none'),
    enabled: Boolean(orgId),
    queryFn: ({ signal }) =>
      apiFetch<InvitationsListResponse>('/api/v1/invitations', { signal }),
    staleTime: 30_000,
  });
}
