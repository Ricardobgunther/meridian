'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { AcceptPreviewResponse } from '@/lib/types/api';

export function invitationPreviewQueryKey(token: string) {
  return ['invitation-preview', token] as const;
}

/**
 * Preview público do convite (GET /api/v1/invitations/accept, token no
 * header X-Invitation-Token — R10).
 *
 * - `skipOrgHeader`: o token é o escopo; nenhum header de org.
 * - `redirectOnAuthError: false`: a página `/invite/[token]` é pública,
 *   um 401 não deve causar redirect para /login (a página decide).
 * - `staleTime: 0`: estado pode mudar a qualquer momento (admin revoga).
 *
 * O caminho principal renderiza isto via Server Component. Esta hook
 * é usada apenas em re-renders client-side (ex.: trocar de sessão).
 */
export function useInvitationPreview(token: string | null | undefined) {
  return useQuery<AcceptPreviewResponse>({
    queryKey: invitationPreviewQueryKey(token ?? 'none'),
    enabled: Boolean(token),
    queryFn: ({ signal }) =>
      // Token in the X-Invitation-Token header, not the path (R10). The
      // `enabled` gate above guarantees `token` is a non-empty string here.
      apiFetch<AcceptPreviewResponse>('/api/v1/invitations/accept', {
        signal,
        headers: { 'X-Invitation-Token': token as string },
        skipOrgHeader: true,
        redirectOnAuthError: false,
      }),
    staleTime: 0,
    gcTime: 60_000,
  });
}
