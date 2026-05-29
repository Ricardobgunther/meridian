'use client';

import { ChevronDown, ChevronUp, CloudOff, UserPlus2 } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n/t';
import { useInvitations } from '@/hooks/use-invitations';
import { useUiStore } from '@/lib/stores/ui-store';
import type { Invitation, Role } from '@/lib/types/api';

import { PendingInvitationRow } from './PendingInvitationRow';

interface PendingInvitationsSectionProps {
  orgId: string;
  viewerRole: Role;
}

const COLLAPSE_THRESHOLD = 5;

function filterPending(items: Invitation[]): Invitation[] {
  return items.filter((i) => i.status === 'pending');
}

/**
 * Seção "Convites pendentes" dentro da página Membros.
 *
 * Visível para todos os roles (J2 do overview). Ações por linha são
 * gateadas em `PendingInvitationRow` por `viewerRole`.
 *
 * Collapse: default expanded quando count ≤ 5; collapsed acima disso. O
 * usuário pode sobrescrever via `useUiStore.invitationsSectionCollapsed`
 * (persistido).
 */
export function PendingInvitationsSection({
  orgId,
  viewerRole,
}: PendingInvitationsSectionProps) {
  const query = useInvitations(orgId);
  const userPref = useUiStore((s) => s.invitationsSectionCollapsed);
  const setUserPref = useUiStore((s) => s.setInvitationsSectionCollapsed);

  const pending = useMemo(
    () => (query.data ? filterPending(query.data.data) : []),
    [query.data],
  );
  const count = pending.length;

  const defaultCollapsed = count > COLLAPSE_THRESHOLD;
  const isCollapsed = userPref === null ? defaultCollapsed : userPref;

  const showHeading = (
    <h2
      id="pending-invites-heading"
      className="text-lg font-semibold text-text-primary"
    >
      {query.data
        ? t.invitations.list.sectionTitleWithCount(count)
        : t.invitations.list.sectionTitle}
    </h2>
  );

  const headingRow = (
    <div className="flex items-center justify-between">
      {showHeading}
      <button
        type="button"
        aria-label={
          isCollapsed
            ? t.invitations.list.collapseToggleShow
            : t.invitations.list.collapseToggleHide
        }
        aria-expanded={!isCollapsed}
        aria-controls="pending-invites-list"
        onClick={() => setUserPref(!isCollapsed)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );

  return (
    <section
      aria-labelledby="pending-invites-heading"
      className="mt-8 flex flex-col gap-3"
    >
      {headingRow}

      <div id="pending-invites-list" hidden={isCollapsed}>
        {query.isPending && !query.data ? (
          <PendingInvitationsSkeleton />
        ) : query.isError ? (
          <PendingInvitationsError onRetry={() => void query.refetch()} />
        ) : count === 0 ? (
          <PendingInvitationsEmpty />
        ) : (
          <ul
            role="list"
            className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-elevated"
          >
            {pending.map((invitation) => (
              <PendingInvitationRow
                key={invitation.id}
                invitation={invitation}
                orgId={orgId}
                viewerRole={viewerRole}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PendingInvitationsSkeleton() {
  return (
    <ul
      role="list"
      aria-busy="true"
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-elevated"
    >
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-4 w-48 rounded bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-4 w-16 rounded bg-surface-sunken motion-safe:animate-pulse" />
          <div className="ml-auto h-4 w-20 rounded bg-surface-sunken motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

function PendingInvitationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft p-8 text-center"
    >
      <CloudOff className="h-10 w-10 text-danger" aria-hidden="true" />
      <p className="text-sm text-danger">{t.invitations.list.loadingError}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t.invitations.list.retry}
      </Button>
    </div>
  );
}

function PendingInvitationsEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-8 text-center">
      <UserPlus2 className="h-8 w-8 text-text-disabled" aria-hidden="true" />
      <p className="text-sm text-text-muted">
        {t.invitations.list.emptyTitle}
      </p>
      <p className="text-xs text-text-disabled">{t.invitations.list.emptyHint}</p>
    </div>
  );
}
