'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/client';
import { announce } from '@/lib/a11y/announce';
import { t } from '@/lib/i18n/t';

/**
 * Recusa o convite (POST /decline → 204).
 *
 * Em sucesso: anúncio + redireciona para `/` (página inicial).
 */
export function useDeclineInvitation(token: string) {
  const router = useRouter();

  return useMutation<void, unknown, void>({
    mutationFn: () =>
      apiFetch<void>(`/api/v1/invitations/accept/${token}/decline`, {
        method: 'POST',
        skipOrgHeader: true,
      }),
    onSuccess: () => {
      announce(t.invitations.accept.declineSuccessAnnouncement);
      router.push('/');
    },
  });
}
