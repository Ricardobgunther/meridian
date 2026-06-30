'use client';

import { AlertCircle, Check } from 'lucide-react';

import { t } from '@/lib/i18n/t';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import type { SlugCheckStatus } from '@/lib/types/api';

export interface SlugAvailabilityProps {
  status: SlugCheckStatus;
}

/**
 * Linha de status de disponibilidade do slug. Advisory: nunca bloqueia o
 * submit — o 422 do POST /organizations segue sendo a fonte da verdade.
 *
 * - Live region única e sempre montada (`aria-live` não re-monta entre
 *   estados — evita re-anúncios fantasmas em SR).
 * - `min-h-5` reserva a linha para o layout não pular entre estados.
 * - "Disponível" em `text-text-primary` (não `text-success`): acomodação
 *   de contraste AA para texto de 14px (spec 03 §2); o ícone carrega a cor.
 * - Falha da checagem = estado `idle` (linha vazia) — silêncio por design.
 *
 * TODO (follow-up, spec 03 §7): ao reusar no GeneralForm de settings,
 * suprimir `taken` quando o slug digitado é o slug ATUAL da organização
 * (está "em uso" por ela mesma).
 */
export function SlugAvailability({ status }: SlugAvailabilityProps) {
  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-5 items-center gap-1.5 text-sm"
    >
      {status === 'checking' && (
        <>
          <SpinnerIcon className="h-4 w-4" />
          <span className="text-text-muted">
            {t.orgs.create.slugCheck.checking}
          </span>
        </>
      )}
      {status === 'available' && (
        <>
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
          <span className="text-text-primary">
            {t.orgs.create.slugCheck.available}
          </span>
        </>
      )}
      {status === 'taken' && (
        <>
          <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />
          <span className="text-danger">{t.orgs.create.errors.slugTaken}</span>
        </>
      )}
    </p>
  );
}
