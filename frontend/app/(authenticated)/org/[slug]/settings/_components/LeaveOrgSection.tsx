'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { t } from '@/lib/i18n/t';
import { announce } from '@/lib/a11y/announce';
import { parseApiError } from '@/lib/api/errors';
import { setCurrentOrgId } from '@/lib/org/current';
import { useLeaveOrg } from '@/hooks/use-leave-org';
import type { Organization, Role } from '@/lib/types/api';

export interface LeaveOrgSectionProps {
  organization: Organization;
  role: Role;
}

/** Lê `body.error` cru do ApiError (fallback PT-BR do backend). */
function readBodyError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const raw = (err as { raw?: unknown }).raw;
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = (raw as Record<string, unknown>).error;
  return typeof msg === 'string' && msg.trim().length > 0 ? msg : null;
}

/** Precedência da spec 04 §2: `code` → dict; senão `body.error`; senão genérico. */
function leaveErrorMessage(err: unknown): string {
  const parsed = parseApiError(err);
  if (parsed.domainCode === 'lone_owner') {
    return t.settings.leaveOrg.errors.loneOwner;
  }
  if (parsed.status === 422) {
    return readBodyError(err) ?? t.settings.leaveOrg.errors.generic;
  }
  return parsed.message;
}

/**
 * Card "Sair da organização" — aba Geral, entre Informações e Zona de
 * perigo. Visível para TODOS os papéis; chrome neutro (vermelho é
 * reservado à destruição da org). Botão sempre habilitado: o backend é a
 * autoridade do invariante lone-owner (J2) — o 422 vira alerta inline no
 * diálogo, não toast.
 */
export function LeaveOrgSection({ organization, role }: LeaveOrgSectionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const leaveMutation = useLeaveOrg(organization.id);

  /** Tenant context mudou: limpa org ativa, wipe TOTAL de cache (mesma
   *  doutrina do use-switch-org) e volta ao dashboard — o Shell re-resolve
   *  a próxima membership ou cai no ShellEmpty. */
  function cleanupAndRedirect() {
    setCurrentOrgId(null);
    void queryClient.invalidateQueries();
    router.push('/dashboard');
    router.refresh();
  }

  async function handleLeave() {
    setErrorMessage(null);
    try {
      await leaveMutation.mutateAsync();
      setConfirmOpen(false);
      toast.success(t.settings.leaveOrg.successToast, {
        description: t.settings.leaveOrg.successToastBody(organization.name),
      });
      announce(t.settings.leaveOrg.announcement(organization.name));
      cleanupAndRedirect();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 403 || parsed.status === 404) {
        // Membership sumiu no meio da sessão (3c): o usuário já está fora —
        // mesma limpeza do sucesso; estado de tenant obsoleto só geraria 403s.
        setConfirmOpen(false);
        toast.error(parsed.title, { description: parsed.message });
        cleanupAndRedirect();
        return;
      }
      // 422 lone_owner / rede / 5xx / 429: alerta inline, diálogo aberto.
      setErrorMessage(leaveErrorMessage(err));
    }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-surface-elevated p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text-primary">
              {t.settings.leaveOrg.title}
            </h2>
            <p className="text-sm text-text-muted">
              {t.settings.leaveOrg.body(organization.name)}
            </p>
            {role === 'owner' && (
              <p className="flex items-center gap-1.5 text-sm text-warning">
                <TriangleAlert
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {t.settings.leaveOrg.ownerHint}
              </p>
            )}
          </div>
          <Button
            variant="danger"
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 max-sm:w-full"
          >
            {t.settings.leaveOrg.cta}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setErrorMessage(null);
        }}
        title={t.settings.leaveOrg.confirmTitle(organization.name)}
        description={t.settings.leaveOrg.confirmBody}
        confirmLabel={
          leaveMutation.isPending
            ? t.settings.leaveOrg.leaving
            : t.settings.leaveOrg.confirm
        }
        cancelLabel={t.settings.leaveOrg.cancel}
        variant="danger"
        loading={leaveMutation.isPending}
        onConfirm={() => void handleLeave()}
      >
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-text-primary"
          >
            {errorMessage}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
