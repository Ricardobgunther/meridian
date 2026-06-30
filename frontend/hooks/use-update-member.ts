'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { t } from '@/lib/i18n/t';
import type {
  Membership,
  Paginated,
  Role,
  SingleResource,
} from '@/lib/types/api';

import { membersQueryKey } from './use-members';

export interface UpdateMemberPayload {
  /**
   * Backend só aceita `admin` ou `member` neste endpoint
   * (ver UpdateMembershipRequest e MembershipService::changeRole).
   * Promoção a `owner` exigiria fluxo de transferência ainda não suportado.
   */
  role: Exclude<Role, 'owner'>;
}

interface Snapshot {
  key: ReturnType<typeof membersQueryKey>;
  data: Paginated<Membership> | undefined;
}

/**
 * Atualiza a função de um membro. Otimista: rola de volta em erro.
 */
export function useUpdateMember(orgId: string, memberId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Membership,
    unknown,
    UpdateMemberPayload,
    { snapshots: Snapshot[] }
  >({
    mutationFn: async ({ role }) => {
      const res = await apiFetch<SingleResource<Membership>>(
        `/api/v1/organizations/${orgId}/members/${memberId}`,
        { method: 'PATCH', json: { role } },
      );
      return res.data;
    },
    onMutate: async ({ role }) => {
      const baseKey = ['organization', orgId, 'members'] as const;
      await queryClient.cancelQueries({ queryKey: baseKey });

      const matches = queryClient.getQueriesData<Paginated<Membership>>({
        queryKey: baseKey,
      });
      const snapshots: Snapshot[] = matches.map(([key, data]) => ({
        key: key as ReturnType<typeof membersQueryKey>,
        data,
      }));

      for (const { key, data } of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<Paginated<Membership>>(key, {
          ...data,
          data: data.data.map((m) => (m.id === memberId ? { ...m, role } : m)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const { key, data } of ctx.snapshots) {
        queryClient.setQueryData(key, data);
      }
      toast.error(t.settings.members.roleUpdateError);
    },
    onSuccess: () => {
      toast.success(t.settings.members.roleUpdated);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', orgId, 'members'],
      });
    },
  });
}
