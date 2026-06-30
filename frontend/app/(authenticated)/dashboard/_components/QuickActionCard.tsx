'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Navegação (Convidar membro, Configurações). */
  href?: string;
  /** Ação local (Nova organização → modal). Ignorado quando há href. */
  onClick?: () => void;
}

const cardClasses =
  'flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-4 text-left ' +
  'transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-surface-sunken ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'motion-safe:active:scale-[0.99]';

/**
 * Card de ação rápida do dashboard. Link ou botão real conforme o efeito
 * (navegação vs. mutação de UI) — visual idêntico (spec 01 §5).
 */
export function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
}: QuickActionCardProps) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="text-sm text-text-muted">{description}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(cardClasses, 'w-full')}>
      {content}
    </button>
  );
}
