'use client';

import { t } from '@/lib/i18n/t';

const pulse = 'rounded-md bg-surface-elevated motion-safe:animate-pulse';

/**
 * Skeleton de página inteira do dashboard — espelha as dimensões do layout
 * final (greeting + grid de 4 stats + grid de 3 ações) para não pular no
 * swap (spec 01 §6.1).
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className={`h-8 w-64 ${pulse}`} />
        <div className={`h-4 w-80 max-w-full ${pulse}`} />
      </div>

      <div className="flex flex-col gap-4">
        <div className={`h-6 w-32 ${pulse}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-4 lg:p-5"
            >
              <div className="h-5 w-24 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="h-8 w-16 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className={`h-6 w-36 ${pulse}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-4"
            >
              <div className="h-9 w-9 shrink-0 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="flex w-full flex-col gap-2">
                <div className="h-4 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
                <div className="h-4 w-3/4 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {t.shell.loading.title}
      </span>
    </div>
  );
}
