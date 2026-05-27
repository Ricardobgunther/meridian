'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MembersPaginationProps {
  currentPage: number;
  lastPage: number;
  onChange: (page: number) => void;
}

/**
 * Paginação numérica simples (‹ 1 2 3 ›). Mostra no máximo 5 botões com
 * janela em volta da página corrente.
 */
export function MembersPagination({
  currentPage,
  lastPage,
  onChange,
}: MembersPaginationProps) {
  const pages = buildPageWindow(currentPage, lastPage);

  return (
    <nav
      aria-label="Paginação de membros"
      className="flex items-center justify-center gap-1 pt-2"
    >
      <PageButton
        disabled={currentPage <= 1}
        onClick={() => onChange(currentPage - 1)}
        ariaLabel="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PageButton>

      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="px-2 text-sm text-text-muted"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            onClick={() => onChange(p)}
            ariaLabel={`Página ${p}`}
            ariaCurrent={p === currentPage}
            active={p === currentPage}
          >
            {p}
          </PageButton>
        ),
      )}

      <PageButton
        disabled={currentPage >= lastPage}
        onClick={() => onChange(currentPage + 1)}
        ariaLabel="Próxima página"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PageButton>
    </nav>
  );
}

interface PageButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
  ariaCurrent?: boolean;
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  ariaLabel,
  ariaCurrent,
}: PageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'motion-reduce:transition-none',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-text-primary hover:bg-surface-elevated',
      )}
    >
      {children}
    </button>
  );
}

function buildPageWindow(
  current: number,
  last: number,
): Array<number | '…'> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const window: Array<number | '…'> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(last - 1, current + 1);

  if (left > 2) window.push('…');
  for (let i = left; i <= right; i++) window.push(i);
  if (right < last - 1) window.push('…');
  window.push(last);

  return window;
}
