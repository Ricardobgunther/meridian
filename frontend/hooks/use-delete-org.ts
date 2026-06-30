'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { setCurrentOrgId } from '@/lib/org/current';
import { t } from '@/lib/i18n/t';

import { ME_QUERY_KEY } from './use-me';
import { ORGS_QUERY_KEY } from './use-organizations';

/**
 * Exclui a org. Em sucesso: limpa localStorage, invalida caches e redireciona
 * para o dashboard (o shell mostra o empty state se não houver outra org).
 */
export function useDeleteOrg(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      await apiFetch<void>(`/api/v1/organizations/${orgId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      setCurrentOrgId(null);
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY });
      toast.success(t.settings.dangerZone.deletedToast);
      router.push('/dashboard');
      router.refresh();
    },
  });
}
