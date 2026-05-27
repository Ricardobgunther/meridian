'use client';

import { useEffect, useMemo, type ReactNode } from 'react';

import { useMe } from '@/hooks/use-me';
import { resolveCurrentOrgId, getCurrentOrgId } from '@/lib/org/current';
import { parseApiError } from '@/lib/api/errors';
import type { ApiError } from '@/lib/types/api';

import { SkipLink } from './SkipLink';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { CreateOrgModal } from './CreateOrgModal';
import {
  ShellLoading,
  ShellError,
  ShellEmpty,
} from './ShellStates';

interface ShellProps {
  children: ReactNode;
}

/**
 * Shell autenticado.
 *
 * - Carrega `/me` via TanStack Query (refresh-on-focus).
 * - Resolve a org ativa em localStorage + mirror em cookie para SSR.
 * - Renderiza topbar + sidebar (ou drawer mobile) + main.
 * - Live regions a11y (polite + assertive) sempre presentes.
 *
 * Sem dados de `me`: render loading, error ou empty conforme o caso.
 */
export function Shell({ children }: ShellProps) {
  const meQuery = useMe();

  const memberships = useMemo(
    () => meQuery.data?.memberships ?? [],
    [meQuery.data],
  );

  // Sincroniza a org ativa sempre que as memberships mudam.
  useEffect(() => {
    if (meQuery.data) {
      resolveCurrentOrgId(memberships);
    }
  }, [meQuery.data, memberships]);

  // Auto-redirect on 401 happens in apiFetch; here qualquer outro erro
  // mostra a tela de fallback.
  const errorParsed = useMemo(() => {
    if (!meQuery.error) return null;
    return parseApiError(meQuery.error);
  }, [meQuery.error]);

  if (meQuery.isPending && !meQuery.data) {
    return <ShellLoading />;
  }

  if (errorParsed && (meQuery.error as unknown as ApiError)?.status !== 401) {
    return <ShellError onRetry={() => meQuery.refetch()} />;
  }

  if (!meQuery.data) {
    return <ShellLoading />;
  }

  const { user } = meQuery.data;
  const currentOrgId = getCurrentOrgId();
  const activeMembership = memberships.find(
    (m) => m.organization.id === currentOrgId,
  );
  const activeOrgSlug = activeMembership?.organization.slug ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SkipLink />

      {/* SR-only live regions (spec 06 §3) */}
      <div
        id="shell-live"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="shell-alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <Topbar
        user={user}
        memberships={memberships}
        currentOrgId={currentOrgId}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex">
          <Sidebar activeOrgSlug={activeOrgSlug} />
        </div>
        <MobileDrawer activeOrgSlug={activeOrgSlug} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 overflow-y-auto focus:outline-none"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
            {memberships.length === 0 ? <ShellEmpty /> : children}
          </div>
        </main>
      </div>

      <CreateOrgModal />
    </div>
  );
}
