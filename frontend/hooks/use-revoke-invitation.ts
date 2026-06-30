'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { announce } from '@/lib/a11y/announce';
import { t } from '@/lib/i18n/t';
import type { InvitationsListResponse } from '@/lib/types/api';

import { invitationsQueryKey } from './use-invitations';

interface Snapshot {
  data: InvitationsListResponse | undefined;
}

/**
 * Revoga um convite (DELETE 204) — otimista.
 *
 * onMutate remove a linha do cache imediatamente; onError restaura a
 * snapshot e mostra toast de erro; onSettled re-fetch para reconciliar
 * com o servidor.
 *
 * O e-mail é passado para os toasts/anúncios — invocação típica:
 * `useRevokeInvitation(orgId, invitation.id, invitation.email)`.
 */
export function useRevokeInvitation(
  orgId: string,
  invitationId: string,
  email: string,
) {
  const queryClient = useQueryClient();
  const key = invitationsQueryKey(orgId);

  return useMutation<void, unknown, void, Snapshot>({
    mutationFn: async () => {
      await apiFetch<void>(`/api/v1/invitations/${invitationId}`, {
        method: 'DELETE',
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const data = queryClient.getQueryData<InvitationsListResponse>(key);
      queryClient.setQueryData<InvitationsListResponse>(key, (old) =>
        old
          ? { ...old, data: old.data.filter((i) => i.id !== invitationId) }
          : old,
      );
      return { data };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.data) {
        queryClient.setQueryData(key, ctx.data);
      }
      toast.error(t.invitations.list.revokeError);
    },
    onSuccess: () => {
      toast.success(t.invitations.list.revokedToast, {
        description: t.invitations.list.revokedToastBody(email),
      });
      announce(t.invitations.list.revokedAnnouncement(email));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
