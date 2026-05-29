'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';
import { useResendInvitation } from '@/hooks/use-resend-invitation';
import { useRevokeInvitation } from '@/hooks/use-revoke-invitation';
import type { Invitation } from '@/lib/types/api';

interface InvitationActionsMenuProps {
  orgId: string;
  invitation: Invitation;
}

/**
 * Menu `···` da linha pendente. Itens:
 *  - Reenviar convite — sem confirm. Spinner no trigger enquanto pendente.
 *  - Revogar convite — abre ConfirmDialog (delete otimista no hook).
 *
 * O ConfirmDialog é controlado por `useUiStore.activeModal` para ficar
 * consistente com o padrão do bloco — porém é "co-locado" aqui porque
 * o estado depende da invitation desta linha.
 */
export function InvitationActionsMenu({
  orgId,
  invitation,
}: InvitationActionsMenuProps) {
  const activeModal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);

  const resendMutation = useResendInvitation(orgId, invitation.id);
  const revokeMutation = useRevokeInvitation(
    orgId,
    invitation.id,
    invitation.email,
  );

  const isRevokeOpen =
    activeModal?.kind === 'confirm-revoke-invitation' &&
    activeModal.invitationId === invitation.id;

  const isResending = resendMutation.isPending;

  function handleResend() {
    if (isResending) return;
    void resendMutation.mutateAsync().catch(() => {
      // erros já tratados via toast no hook
    });
  }

  function handleRevokeRequest() {
    openModal({
      kind: 'confirm-revoke-invitation',
      invitationId: invitation.id,
      invitationEmail: invitation.email,
    });
  }

  async function handleRevokeConfirm() {
    try {
      await revokeMutation.mutateAsync();
      closeModal();
    } catch {
      // ConfirmDialog permanece aberto para retry; toast já saiu via hook.
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={t.invitations.list.actionsMenu(invitation.email)}
            aria-busy={isResending}
            disabled={isResending}
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait"
          >
            {isResending ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-dropdown w-48 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg"
          >
            <DropdownMenu.Item
              onSelect={() => handleResend()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none"
            >
              {t.invitations.list.actionResend}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => handleRevokeRequest()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-soft focus:bg-danger-soft focus:outline-none"
            >
              {t.invitations.list.actionRevoke}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={isRevokeOpen}
        onOpenChange={(o) => {
          if (!o) closeModal();
        }}
        title={t.invitations.list.confirmRevokeTitle}
        description={t.invitations.list.confirmRevokeBody(invitation.email)}
        confirmLabel={
          revokeMutation.isPending
            ? t.invitations.list.revoking
            : t.invitations.list.confirmRevokeCta
        }
        cancelLabel={t.invitations.list.confirmRevokeCancel}
        variant="danger"
        loading={revokeMutation.isPending}
        onConfirm={handleRevokeConfirm}
      />
    </>
  );
}
