'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { formatAbsolute, formatRelative } from '@/lib/utils/format';
import { useUpdateMember } from '@/hooks/use-update-member';
import { useRemoveMember } from '@/hooks/use-remove-member';
import type { Membership, Role } from '@/lib/types/api';

import {
  MemberRoleControl,
  ROLE_RANK,
  type AssignableRole,
} from './MemberRoleControl';

interface MemberRowProps {
  membership: Membership;
  orgId: string;
  orgName: string;
  viewerRole: Role;
  viewerUserId: string;
  ownerCount: number;
}

/**
 * Linha de membro com avatar, nome/email, role control, joined-at e menu
 * de ações. Aplica matriz de permissões da spec 04 §6.
 * Backend é a autoridade — UI só esconde controles indisponíveis.
 */
export function MemberRow({
  membership,
  orgId,
  orgName,
  viewerRole,
  viewerUserId,
  ownerCount,
}: MemberRowProps) {
  const [removeOpen, setRemoveOpen] = useState(false);

  const updateMutation = useUpdateMember(orgId, membership.id);
  const removeMutation = useRemoveMember(
    orgId,
    membership.id,
    membership.user?.name?.trim() || membership.user?.email || 'Membro',
  );

  const target = membership.role;
  const isSelf = membership.user?.id === viewerUserId;
  const viewerCanManage = viewerRole === 'owner' || viewerRole === 'admin';
  const outranked = ROLE_RANK[target] >= ROLE_RANK[viewerRole];
  const isLastOwner = target === 'owner' && ownerCount <= 1;

  const canChangeRole =
    viewerCanManage && !isSelf && !outranked && !isLastOwner;
  const canRemove = viewerCanManage && !isSelf && !outranked && !isLastOwner;

  const memberName =
    membership.user?.name?.trim() || membership.user?.email || 'Membro';
  const memberEmail = membership.user?.email ?? '';

  function lockReason(): string {
    if (isSelf) return t.settings.members.cantChangeSelf;
    if (isLastOwner) return t.settings.members.cantDemoteLastOwner;
    return '';
  }

  function handleRoleSelect(newRole: AssignableRole) {
    if (newRole === target) return;
    void updateMutation.mutateAsync({ role: newRole });
  }

  const isBusy = updateMutation.isPending || removeMutation.isPending;

  return (
    <li
      className={cn(
        'flex items-center gap-4 px-4 py-3 transition-colors duration-fast ease-standard hover:bg-surface-sunken',
        isBusy && 'opacity-70',
      )}
      aria-busy={isBusy}
    >
      <Avatar
        seed={membership.user?.id ?? membership.id}
        label={memberName}
        imageUrl={membership.user?.avatar_url}
        size={40}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {memberName}
        </p>
        {memberEmail && (
          <p className="truncate text-xs text-text-muted">{memberEmail}</p>
        )}
      </div>

      <MemberRoleControl
        currentRole={target}
        memberName={memberName}
        viewerRole={viewerRole}
        canChangeRole={canChangeRole}
        lockReason={lockReason()}
        onSelect={handleRoleSelect}
      />

      <time
        dateTime={membership.joined_at}
        title={formatAbsolute(membership.joined_at)}
        className="hidden text-xs tabular-nums text-text-muted sm:inline"
      >
        {formatRelative(membership.joined_at)}
      </time>

      {canRemove ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={t.settings.members.actionsMenu(memberName)}
              className="rounded-md p-1 text-text-muted hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-dropdown w-44 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg"
            >
              <DropdownMenu.Item
                onSelect={() => setRemoveOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-soft focus:bg-danger-soft focus:outline-none"
              >
                {t.settings.members.remove}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <span className="w-7" aria-hidden="true">
          {isBusy && <SpinnerIcon className="h-4 w-4 text-text-muted" />}
        </span>
      )}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t.settings.members.confirmRemoveTitle(memberName)}
        description={t.settings.members.confirmRemoveBody(memberName, orgName)}
        confirmLabel={t.settings.members.confirmRemoveCta}
        cancelLabel={t.settings.members.confirmCancel}
        variant="danger"
        loading={removeMutation.isPending}
        onConfirm={async () => {
          await removeMutation.mutateAsync();
          setRemoveOpen(false);
        }}
      />
    </li>
  );
}
