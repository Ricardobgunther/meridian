'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { announce } from '@/lib/a11y/announce';
import { parseApiError } from '@/lib/api/errors';
import { t } from '@/lib/i18n/t';
import type {
  ApiError,
  Invitation,
  SingleResource,
} from '@/lib/types/api';

import { invitationsQueryKey } from './use-invitations';

/**
 * Reenvia o convite (POST). NÃO otimista: o impacto visível é o
 * `expires_at` resetar, e simular esse shift e dar rollback fica jarring.
 *
 * Em sucesso: toast + anúncio + invalida a query.
 * Em 429: toast específico de rate-limit ("Aguarde para reenviar").
 * Em outros erros: toast genérico com a mensagem do backend.
 */
export function useResendInvitation(orgId: string, invitationId: string) {
  const queryClient = useQueryClient();
  const key = invitationsQueryKey(orgId);

  return useMutation<Invitation, unknown, void>({
    mutationFn: async () => {
      const res = await apiFetch<SingleResource<Invitation>>(
        `/api/v1/invitations/${invitationId}/resend`,
        { method: 'POST' },
      );
      return res.data;
    },
    onSuccess: (invitation) => {
      const email = invitation.email;
      toast.success(t.invitations.list.resentToast, {
        description: t.invitations.list.resentToastBody(email),
      });
      announce(t.invitations.list.resentAnnouncement(email));
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => {
      const apiErr = err as Partial<ApiError>;
      if (apiErr?.status === 429) {
        toast.error(t.invitations.list.resendRateLimitedTitle, {
          description: t.invitations.list.resendRateLimitedBody,
        });
        return;
      }
      const parsed = parseApiError(err);
      toast.error(t.invitations.list.resendError, {
        description: parsed.message,
      });
    },
  });
}
