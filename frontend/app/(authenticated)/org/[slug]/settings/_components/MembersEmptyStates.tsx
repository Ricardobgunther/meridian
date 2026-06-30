'use client';

import { CloudOff, SearchX, Users } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n/t';

/**
 * Estados auxiliares da lista de membros: skeleton, erro, filtros sem
 * resultado, e "você é o único membro". Extraídos para manter o MembersTab
 * dentro do limite de 200 linhas.
 */

export function MembersListSkeleton() {
  return (
    <ul
      role="list"
      aria-busy="true"
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-elevated"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-10 w-10 rounded-pill bg-surface-sunken motion-safe:animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-1/3 rounded bg-surface-sunken motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-surface-sunken motion-safe:animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MembersErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft p-8 text-center"
    >
      <CloudOff className="h-10 w-10 text-danger" aria-hidden="true" />
      <p className="text-sm text-danger">
        {t.settings.members.states.loadingError}
      </p>
      <Button variant="primary" onClick={onRetry}>
        {t.settings.members.states.retry}
      </Button>
    </div>
  );
}

export function MembersFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-elevated p-8 text-center">
      <SearchX className="h-10 w-10 text-text-muted" aria-hidden="true" />
      <p className="text-sm text-text-muted">
        {t.settings.members.states.noFilteredResults}
      </p>
      <Button variant="secondary" onClick={onClear}>
        {t.settings.members.states.clearFilters}
      </Button>
    </div>
  );
}

export function MembersOnlyViewer() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-elevated p-8 text-center">
      <Users className="h-10 w-10 text-text-muted" aria-hidden="true" />
      <p className="text-sm text-text-muted">
        {t.settings.members.states.onlyViewer}
      </p>
    </div>
  );
}
