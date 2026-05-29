'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type {
  Invitation,
  InvitationRole,
  SingleResource,
} from '@/lib/types/api';

import { invitationsQueryKey } from './use-invitations';

export interface CreateInvitationPayload {
  email: string;
  role: InvitationRole;
}

/**
 * Cria um convite. Toast / anúncio / closeModal são responsabilidade do
 * caller (o modal), porque ele também precisa mapear erros 409 para o
 * campo de email. Esta hook só dispara a request e invalida a query.
 */
export function useCreateInvitation(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Invitation, unknown, CreateInvitationPayload>({
    mutationFn: async ({ email, role }) => {
      const res = await apiFetch<SingleResource<Invitation>>(
        '/api/v1/invitations',
        { method: 'POST', json: { email, role } },
      );
      return res.data;
    },
    onSuccess: () => {
      if (!orgId) return;
      queryClient.invalidateQueries({ queryKey: invitationsQueryKey(orgId) });
    },
  });
}
