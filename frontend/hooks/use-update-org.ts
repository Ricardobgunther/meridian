'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { t } from '@/lib/i18n/t';
import type { Organization, SingleResource } from '@/lib/types/api';

import { ME_QUERY_KEY } from './use-me';
import { ORGS_QUERY_KEY } from './use-organizations';
import { organizationQueryKey } from './use-organization';

export interface UpdateOrgPayload {
  name?: string;
  slug?: string;
}

/**
 * Atualiza nome/slug da organização. Não trata sucesso de troca de slug
 * (rota) aqui — o caller decide se router.replace é necessário.
 */
export function useUpdateOrg(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation<Organization, unknown, UpdateOrgPayload>({
    mutationFn: async (payload) => {
      const res = await apiFetch<SingleResource<Organization>>(
        `/api/v1/organizations/${orgId}`,
        {
          method: 'PATCH',
          json: payload,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationQueryKey(orgId) });
      queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success(t.settings.general.savedToast);
    },
  });
}
