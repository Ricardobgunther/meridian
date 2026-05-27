'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { setCurrentOrgId } from '@/lib/org/current';
import { t } from '@/lib/i18n/t';
import type { Organization, SingleResource } from '@/lib/types/api';

import { ME_QUERY_KEY } from './use-me';
import { ORGS_QUERY_KEY } from './use-organizations';

export interface CreateOrgPayload {
  name: string;
  slug: string;
}

/**
 * Cria uma nova organização. Em sucesso:
 * - persiste como org ativa
 * - invalida `me` + `organizations`
 * - mostra toast
 *
 * O caller (modal) trata 422 lendo `error.fieldErrors` via `parseApiError`.
 */
export function useCreateOrg() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<Organization, unknown, CreateOrgPayload>({
    mutationFn: async (payload) => {
      const res = await apiFetch<SingleResource<Organization>>(
        '/api/v1/organizations',
        {
          method: 'POST',
          json: payload,
          skipOrgHeader: true,
        },
      );
      return res.data;
    },
    onSuccess: (org) => {
      setCurrentOrgId(org.id);
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY });
      toast.success(t.orgs.create.success);
      // TODO: trocar para /org/{slug}/dashboard quando existir.
      router.push('/dashboard');
      router.refresh();
    },
  });
}
