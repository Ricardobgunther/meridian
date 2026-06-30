'use client';

import { Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAbsolute } from '@/lib/utils/format';
import { t } from '@/lib/i18n/t';

export interface InvitationStatusPillProps {
  expiresAt: string;
  className?: string;
}

interface Tier {
  /** Pílula visível (background pinta o sinal — texto fica primary). */
  pillClass: string;
  /** Quando true, o texto vira font-medium para ênfase extra. */
  emphasize: boolean;
  /** Quando true, anuncia "Expira em breve" como sr-only. */
  urgent: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pickTier(diffMs: number): Tier {
  // Já passou (servidor é a verdade — UI segura na exibição).
  if (diffMs <= 0) {
    return {
      pillClass: 'bg-danger-soft text-danger',
      emphasize: true,
      urgent: true,
    };
  }
  if (diffMs < MS_PER_DAY) {
    return {
      pillClass: 'bg-danger-soft text-text-primary',
      emphasize: true,
      urgent: true,
    };
  }
  if (diffMs <= 3 * MS_PER_DAY) {
    return {
      pillClass: 'bg-warning-soft text-text-primary',
      emphasize: false,
      urgent: true,
    };
  }
  return {
    pillClass: 'bg-surface-sunken text-text-muted',
    emphasize: false,
    urgent: false,
  };
}

function formatExpiresIn(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'expirado';

  // `Intl.RelativeTimeFormat` com `numeric: 'always'` produz "em 6 dias".
  const fmt = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' });
  const days = Math.round(diff / MS_PER_DAY);
  if (Math.abs(days) >= 1) return fmt.format(days, 'day');
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (Math.abs(hours) >= 1) return fmt.format(hours, 'hour');
  const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
  return fmt.format(minutes, 'minute');
}

/**
 * Pílula compacta "em N dias" com cor por urgência. O background pinta o
 * sinal (warning/danger); o texto fica `text-text-primary` para garantir
 * contraste WCAG (delta uiux §5.1).
 */
export function InvitationStatusPill({
  expiresAt,
  className,
}: InvitationStatusPillProps) {
  const date = new Date(expiresAt);
  const diff = Number.isNaN(date.getTime()) ? 0 : date.getTime() - Date.now();
  const tier = pickTier(diff);
  const label = formatExpiresIn(expiresAt);
  const tooltip = Number.isNaN(date.getTime())
    ? label
    : t.invitations.list.expiresInTooltip(formatAbsolute(expiresAt));

  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs tabular-nums',
        tier.pillClass,
        tier.emphasize && 'font-medium',
        className,
      )}
    >
      {tier.urgent && (
        <Clock className="h-3 w-3" aria-hidden="true" />
      )}
      <span>{label}</span>
      {tier.urgent && (
        <span className="sr-only">{t.invitations.list.expiresUrgent}</span>
      )}
    </span>
  );
}
