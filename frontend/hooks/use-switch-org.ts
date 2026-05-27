'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { setCurrentOrgId, getCurrentOrgId } from '@/lib/org/current';
import { announce } from '@/lib/a11y/announce';
import { t } from '@/lib/i18n/t';

interface SwitchOrgInput {
  id: string;
  name: string;
}

/**
 * Troca a org ativa. Soft-reload via `router.refresh()` para evitar flash
 * branco — Server Components re-renderizam com a nova org.
 *
 * Invalida o cache inteiro porque mudamos efetivamente de tenant.
 * Em erro, restaura o storage anterior e mostra toast.
 */
export function useSwitchOrg() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const switchOrg = useCallback(
    async ({ id, name }: SwitchOrgInput) => {
      const previous = getCurrentOrgId();
      if (previous === id) return;

      setPendingId(id);
      setCurrentOrgId(id);
      try {
        await queryClient.invalidateQueries();
        router.refresh();
        announce(t.orgs.switcher.switchedTo(name));
      } catch {
        setCurrentOrgId(previous);
        toast.error(t.orgs.switcher.switchError);
      } finally {
        setPendingId(null);
      }
    },
    [queryClient, router],
  );

  return { switchOrg, pendingId };
}
