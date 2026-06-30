'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { t } from '@/lib/i18n/t';
import { parseApiError } from '@/lib/api/errors';
import { useDeleteOrg } from '@/hooks/use-delete-org';
import type { Organization } from '@/lib/types/api';

interface DangerZoneProps {
  organization: Organization;
}

/**
 * Card de "Zona de perigo" para owners. Botão "Excluir organização" abre
 * diálogo que exige digitar o nome exato (case-sensitive) para confirmar.
 */
export function DangerZone({ organization }: DangerZoneProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const deleteMutation = useDeleteOrg(organization.id);

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
      setConfirmOpen(false);
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.title, {
        description:
          parsed.status === 403
            ? t.settings.dangerZone.deleteForbidden
            : parsed.message,
      });
    }
  }

  function handleOpenChange(open: boolean) {
    setConfirmOpen(open);
    if (!open) setTyped('');
  }

  return (
    <>
      <section className="rounded-lg border border-danger/40 bg-surface-elevated p-6">
        <h2 className="text-lg font-semibold text-danger">
          {t.settings.dangerZone.title}
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">
              {t.settings.dangerZone.deleteTitle}
            </p>
            <p className="text-sm text-text-muted">
              {t.settings.dangerZone.deleteBody}
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 max-sm:w-full"
          >
            {t.settings.dangerZone.deleteCta}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        title={t.settings.dangerZone.confirmTitle}
        description={t.settings.dangerZone.confirmBody}
        confirmLabel={t.settings.dangerZone.confirm}
        cancelLabel={t.settings.dangerZone.cancel}
        variant="danger"
        loading={deleteMutation.isPending}
        confirmDisabled={typed !== organization.name}
        onConfirm={() => void handleDelete()}
      >
        <div className="space-y-2">
          <p className="text-sm text-text-primary">
            {t.settings.dangerZone.confirmTypePrompt}
          </p>
          <p className="rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-sm text-text-primary">
            {organization.name}
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={t.settings.dangerZone.confirmTypeLabel}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            disabled={deleteMutation.isPending}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
