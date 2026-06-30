'use client';

import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';

/**
 * Sai da organização (auto-remoção da própria membership).
 *
 * POST /api/v1/organizations/{id}/leave → 204. NÃO otimista: o tenant
 * context só é desmontado depois da confirmação do servidor (spec 02 §3
 * item 4). Os efeitos pós-sucesso (limpar org ativa, wipe total de cache,
 * toast, redirect) vivem no componente — ver LeaveOrgSection.
 *
 * Erros relevantes: 422 `{ error, code: 'lone_owner' }`, 403/404 quando a
 * membership já não existe.
 */
export function useLeaveOrg(orgId: string) {
  return useMutation<void, unknown, void>({
    mutationFn: () =>
      apiFetch<void>(`/api/v1/organizations/${orgId}/leave`, {
        method: 'POST',
      }),
  });
}
