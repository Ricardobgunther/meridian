'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';
import { t } from '@/lib/i18n/t';
import type { Membership, Paginated } from '@/lib/types/api';

import { membersQueryKey } from './use-members';

interface Snapshot {
  key: ReturnType<typeof membersQueryKey>;
  data: Paginated<Membership> | undefined;
}

/**
 * Remove um membro da organização (DELETE 204). Otimista: remove a linha
 * imediatamente, restaura em erro.
 */
export function useRemoveMember(
  orgId: string,
  memberId: string,
  memberName: string,
) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, void, { snapshots: Snapshot[] }>({
    mutationFn: async () => {
      await apiFetch<void>(
        `/api/v1/organizations/${orgId}/members/${memberId}`,
        { method: 'DELETE' },
      );
    },
    onMutate: async () => {
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
          data: data.data.filter((m) => m.id !== memberId),
          meta: {
            ...data.meta,
            total: Math.max(0, data.meta.total - 1),
          },
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const { key, data } of ctx.snapshots) {
        queryClient.setQueryData(key, data);
      }
      toast.error(t.settings.members.removeError);
    },
    onSuccess: () => {
      toast.success(t.settings.members.removed(memberName));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization', orgId, 'members'],
      });
    },
  });
}
