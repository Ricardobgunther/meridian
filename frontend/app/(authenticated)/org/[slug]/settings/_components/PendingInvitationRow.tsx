'use client';

import { RoleBadge } from '@/components/ui/RoleBadge';
import { t } from '@/lib/i18n/t';
import type { Invitation, Role } from '@/lib/types/api';

import { InvitationActionsMenu } from './InvitationActionsMenu';
import { InvitationStatusPill } from './InvitationStatusPill';

interface PendingInvitationRowProps {
  invitation: Invitation;
  orgId: string;
  viewerRole: Role;
}

/**
 * Linha de convite pendente. Render diferente em mobile (< md): email em
 * linha 1, role + expira em linha 2; coluna "convidado por" só em md+.
 *
 * Para viewer = member o menu `···` não é renderizado (J2 em 00-overview).
 */
export function PendingInvitationRow({
  invitation,
  orgId,
  viewerRole,
}: PendingInvitationRowProps) {
  const inviter = invitation.invited_by;
  const inviterName = inviter?.name?.trim() || inviter?.email || null;
  const inactiveInviter = inviter ? !inviter.is_active_member : false;
  const canManage = viewerRole === 'owner' || viewerRole === 'admin';

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
          {invitation.email}
        </p>

        <div className="flex items-center gap-3 md:gap-4">
          <RoleBadge
            role={invitation.role as Role}
            className="md:w-20 md:justify-start"
          />

          {inviterName ? (
            <span
              className="hidden min-w-0 truncate text-xs text-text-muted md:inline md:w-40"
              title={
                inactiveInviter ? t.invitations.list.inviterNoLongerMember : undefined
              }
            >
              <span className="text-text-disabled">convidado por </span>
              <span className={inactiveInviter ? 'italic' : undefined}>
                {inviterName}
              </span>
            </span>
          ) : (
            <span className="hidden md:inline md:w-40" aria-hidden="true" />
          )}

          <InvitationStatusPill expiresAt={invitation.expires_at} />
        </div>
      </div>

      {canManage ? (
        <InvitationActionsMenu orgId={orgId} invitation={invitation} />
      ) : (
        <span className="w-10" aria-hidden="true" />
      )}
    </li>
  );
}
