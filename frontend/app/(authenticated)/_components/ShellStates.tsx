'use client';

import { CloudOff, Sparkles, Plus, Info } from 'lucide-react';
import { useState } from 'react';

import { t } from '@/lib/i18n/t';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils';

/**
 * Skeleton de primeiro paint. Renderiza a estrutura sem dados de `me`.
 * Pulse desativado sob prefers-reduced-motion via animate-pulse padrão Tailwind.
 */
export function ShellLoading() {
  return (
    <div className="flex h-screen flex-col bg-surface">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4 lg:px-6">
        <div className="h-7 w-7 rounded-md bg-surface-elevated motion-safe:animate-pulse" />
        <div className="h-5 w-32 rounded-md bg-surface-elevated motion-safe:animate-pulse" />
        <div className="ml-auto h-8 w-8 rounded-pill bg-surface-elevated motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-60 flex-col gap-2 border-r border-border p-3 lg:flex">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 rounded-md bg-surface-elevated motion-safe:animate-pulse"
            />
          ))}
        </div>
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="h-8 w-1/3 rounded-md bg-surface-elevated motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded-md bg-surface-elevated motion-safe:animate-pulse" />
            <div className="h-40 rounded-md bg-surface-elevated motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {t.shell.loading.title}
      </span>
    </div>
  );
}

interface ShellErrorProps {
  onRetry: () => void;
}

/**
 * Erro de carregar `/me` — substitui o shell inteiro porque sem `me` não
 * temos topbar/sidebar utilizáveis.
 */
export function ShellError({ onRetry }: ShellErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-surface p-6"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <CloudOff
          className="h-12 w-12 text-text-muted"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold text-text-primary">
          {t.shell.errors.profileTitle}
        </h1>
        <p className="text-sm text-text-muted">{t.shell.errors.profileBody}</p>
        <Button onClick={onRetry} variant="primary">
          {t.shell.errors.retry}
        </Button>
      </div>
    </div>
  );
}

/**
 * Empty state — usuário logado sem memberships (ADR-012).
 * Renderiza dentro do main content; o shell está ativo, mas o sidebar disabled.
 */
export function ShellEmpty() {
  const openModal = useUiStore((s) => s.openModal);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-12 text-center">
      <Sparkles
        className="h-16 w-16 text-text-muted"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold text-text-primary">
        {t.shell.empty.welcomeTitle}
      </h1>
      <p className="max-w-md text-base text-text-muted">
        {t.shell.empty.welcomeBody}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          variant="primary"
          onClick={() => openModal({ kind: 'create-org' })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.shell.empty.createOrg}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          {t.shell.empty.waitInvite}
        </Button>
      </div>
      {showInfo && (
        <div
          role="status"
          className={cn(
            'max-w-md rounded-md border border-info/40 bg-info-soft p-4 text-left text-sm text-text-primary',
          )}
        >
          {t.shell.empty.waitInviteBody}
        </div>
      )}
    </div>
  );
}
