'use client';

import Link from 'next/link';
import { RotateCw, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  /** Valor já formatado; null enquanto a query carrega (skeleton). */
  value: string | null;
  /** Destino do link-card (Membros, Convites). Sem href = card estático. */
  href?: string;
  /** Erro ao carregar a contagem — vira card estático com retry. */
  isError?: boolean;
  onRetry?: () => void;
}

const cardBase =
  'flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-4 lg:p-5';

const interactive =
  'transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-surface-sunken ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'motion-safe:active:scale-[0.99]';

/**
 * Card de estatística do dashboard. Label + valor formam um único nome
 * acessível (label primeiro no DOM → SR lê "Membros, 24"); link-cards
 * ganham o sufixo sr-only "Ver detalhes". Em erro o card deixa de ser
 * link — nunca navegar para uma contagem quebrada (spec 01 §4).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  href,
  isError,
  onRetry,
}: StatCardProps) {
  const labelRow = (
    <span className="flex items-center gap-1.5 text-sm text-text-muted">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );

  if (isError) {
    return (
      <div className={cardBase}>
        {labelRow}
        <span className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums text-text-muted">
            —
          </span>
          <span className="sr-only">{t.dashboard.stats.loadError}</span>
          <button
            type="button"
            aria-label={t.dashboard.stats.retry(label)}
            onClick={onRetry}
            className="rounded-md p-1.5 text-text-muted transition-colors duration-fast ease-standard hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
      </div>
    );
  }

  const valueRow =
    value === null ? (
      <span className="h-8 w-16 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
    ) : (
      <span className="text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </span>
    );

  if (href) {
    return (
      <Link href={href} className={cn(cardBase, interactive)}>
        {labelRow}
        {valueRow}
        <span className="sr-only">{t.dashboard.stats.viewDetails}</span>
      </Link>
    );
  }

  // Card estático: sem hover/cursor — nunca fingir interatividade.
  return (
    <div className={cardBase}>
      {labelRow}
      {valueRow}
    </div>
  );
}
