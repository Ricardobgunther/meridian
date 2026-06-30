'use client';

import { Building2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n/t';

export interface NoActiveOrgPanelProps {
  onCreate: () => void;
}

/**
 * Estado 4 do dashboard — memberships existem mas nenhuma org ativa
 * resolveu. Rail defensivo (spec 01 §6.2); empty state sempre com CTA.
 */
export function NoActiveOrgPanel({ onCreate }: NoActiveOrgPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface-elevated p-8 text-center">
      <Building2 className="h-10 w-10 text-text-muted" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          {t.dashboard.states.noActiveOrgTitle}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t.dashboard.states.noActiveOrgBody}
        </p>
      </div>
      <Button variant="primary" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t.dashboard.states.noActiveOrgCta}
      </Button>
    </div>
  );
}

export interface OrgErrorBannerProps {
  onRetry: () => void;
}

/**
 * Estado 5 — erro ao carregar a org ativa. Substitui as duas seções;
 * o retry refaz org + contagens (spec 01 §6.3).
 */
export function OrgErrorBanner({ onRetry }: OrgErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger-soft p-4 sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm text-text-primary">
        {t.dashboard.states.orgErrorBody}
      </p>
      <Button variant="secondary" className="shrink-0" onClick={onRetry}>
        {t.dashboard.states.orgErrorRetry}
      </Button>
    </div>
  );
}
