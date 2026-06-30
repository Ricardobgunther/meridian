'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/client';
import { announce } from '@/lib/a11y/announce';
import { setCurrentOrgId } from '@/lib/org/current';
import { t } from '@/lib/i18n/t';
import type { AcceptResponse } from '@/lib/types/api';

/**
 * Aceita o convite. NÃO otimista — uma navegação para uma org sem acesso
 * é pior do que esperar a confirmação do servidor.
 *
 * Em sucesso:
 *   1. invalida o cache inteiro (mudança de tenant).
 *   2. seta a nova org como ativa.
 *   3. anuncia (mesmo que a página se desmonte, o announce dispara antes).
 *   4. navega para `/org/{slug}`.
 */
export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<AcceptResponse, unknown, void>({
    mutationFn: () =>
      // Token in the X-Invitation-Token header, not the path (R10).
      apiFetch<AcceptResponse>('/api/v1/invitations/accept', {
        method: 'POST',
        headers: { 'X-Invitation-Token': token },
        skipOrgHeader: true,
      }),
    onSuccess: (resp) => {
      const org = resp.data.organization;
      queryClient.invalidateQueries();
      if (org) {
        setCurrentOrgId(org.id);
        announce(t.invitations.accept.acceptSuccessAnnouncement(org.name));
        router.push(`/org/${org.slug}`);
      } else {
        announce(t.invitations.accept.acceptSuccessAnnouncement('a organização'));
        router.push('/me');
      }
    },
  });
}
