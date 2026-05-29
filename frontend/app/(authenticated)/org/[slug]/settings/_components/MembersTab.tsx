'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n/t';
import { useMe } from '@/hooks/use-me';
import { useActiveOrg } from '@/hooks/use-active-org';
import { useMembers } from '@/hooks/use-members';
import { useUiStore } from '@/lib/stores/ui-store';

import { InviteModal } from './InviteModal';
import { MemberRow } from './MemberRow';
import { MembersPagination } from './MembersPagination';
import { MembersToolbar, type RoleFilter } from './MembersToolbar';
import {
  MembersErrorState,
  MembersFilteredEmpty,
  MembersListSkeleton,
  MembersOnlyViewer,
} from './MembersEmptyStates';
import { PendingInvitationsSection } from './PendingInvitationsSection';

interface MembersTabProps {
  slug: string;
}

/**
 * Aba "Membros". Orquestra toolbar + lista + paginação + estados auxiliares.
 *
 * Search é debounced 300ms client-side antes de virar query string.
 * Filtros e paginação resetam a paginação para 1.
 */
export function MembersTab({ slug }: MembersTabProps) {
  const meQuery = useMe();
  const { organization, role, isLoading: orgLoading } = useActiveOrg(slug);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const membersQuery = useMembers(organization?.id, {
    page,
    q: debouncedSearch || undefined,
    role: roleFilter,
  });

  const viewerUserId = meQuery.data?.user.id ?? '';
  const ownerCount = useMemo(() => {
    return (
      membersQuery.data?.data.filter((m) => m.role === 'owner').length ?? 0
    );
  }, [membersQuery.data]);

  if (orgLoading || !organization || !role) {
    return (
      <div className="space-y-3">
        <div className="h-7 w-32 rounded bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-10 rounded bg-surface-sunken motion-safe:animate-pulse" />
        <MembersListSkeleton />
      </div>
    );
  }

  const total = membersQuery.data?.meta.total ?? 0;
  const isLoading = membersQuery.isPending;
  const isError = membersQuery.isError;
  const items = membersQuery.data?.data ?? [];
  const hasFilters = Boolean(debouncedSearch) || roleFilter !== 'all';

  function clearFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setRoleFilter('all');
    setPage(1);
  }

  const canInvite = role === 'owner' || role === 'admin';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          {t.settings.members.countLabel(total)}
        </h2>
        {canInvite && <InviteMemberCta />}
      </header>

      <MembersToolbar
        searchInput={searchInput}
        roleFilter={roleFilter}
        onSearchChange={setSearchInput}
        onRoleFilterChange={(v) => {
          setRoleFilter(v);
          setPage(1);
        }}
      />

      {isError ? (
        <MembersErrorState onRetry={() => void membersQuery.refetch()} />
      ) : isLoading && !membersQuery.data ? (
        <MembersListSkeleton />
      ) : items.length === 0 ? (
        hasFilters ? (
          <MembersFilteredEmpty onClear={clearFilters} />
        ) : (
          <MembersOnlyViewer />
        )
      ) : (
        <ul
          role="list"
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-elevated"
        >
          {items.map((membership) => (
            <MemberRow
              key={membership.id}
              membership={membership}
              orgId={organization.id}
              orgName={organization.name}
              viewerRole={role}
              viewerUserId={viewerUserId}
              ownerCount={ownerCount}
            />
          ))}
        </ul>
      )}

      {membersQuery.data && membersQuery.data.meta.last_page > 1 && (
        <MembersPagination
          currentPage={membersQuery.data.meta.current_page}
          lastPage={membersQuery.data.meta.last_page}
          onChange={setPage}
        />
      )}

      <PendingInvitationsSection orgId={organization.id} viewerRole={role} />

      <InviteModal orgId={organization.id} />
    </div>
  );
}

/**
 * CTA "Convidar membro" do header. Botão controla o uiStore — separado em
 * sub-componente para manter o `MembersTab` enxuto.
 */
function InviteMemberCta() {
  const openModal = useUiStore((s) => s.openModal);
  return (
    <Button
      variant="primary"
      size="md"
      onClick={() => openModal({ kind: 'invite-member' })}
    >
      {t.invitations.modal.triggerCta}
    </Button>
  );
}
