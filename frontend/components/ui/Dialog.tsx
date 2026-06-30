'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Texto curto sob o título (opcional). */
  description?: string;
  /** Conteúdo do corpo. Tipicamente um form + footer. */
  children: ReactNode;
  /** Hint discreto para SR no `aria-describedby`, se não houver description. */
  ariaDescribedBy?: string;
  /** Aplica ancoragem mobile bottom-sheet quando true (default true). */
  mobileBottomSheet?: boolean;
  /** Sobrescreve max-width do painel. Default `max-w-md` (~480px). */
  maxWidth?: string;
  /** Label do botão X. Default "Fechar". */
  closeLabel?: string;
  /** Callback no autofocus inicial; previne default e foca quem o caller indicar. */
  onOpenAutoFocus?: (event: Event) => void;
  /** id opcional para a `Dialog.Description` (composição com aria-describedby). */
  descriptionId?: string;
}

/**
 * Dialog base — wrapper acima de Radix Dialog que carrega:
 *
 * - overlay + content com keyframes do design system,
 * - botão X (top-right) com `aria-label` configurável,
 * - layout responsivo (bottom-sheet em telas < sm),
 * - cabeçalho com title + (optional) description ligados via aria-*.
 *
 * Quem renderiza o footer/CTA é o caller — este componente é cego ao
 * conteúdo, exatamente como o `ConfirmDialog` faz hoje.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  ariaDescribedBy,
  mobileBottomSheet = true,
  maxWidth = 'max-w-md',
  closeLabel = 'Fechar',
  onOpenAutoFocus,
  descriptionId,
}: DialogProps) {
  const describedBy = descriptionId ?? ariaDescribedBy;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-modal bg-overlay data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <RadixDialog.Content
          aria-describedby={describedBy}
          onOpenAutoFocus={onOpenAutoFocus}
          className={cn(
            'fixed left-1/2 top-1/2 z-modal flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface-elevated p-6 shadow-lg',
            maxWidth,
            'data-[state=open]:animate-scale-in motion-reduce:animate-none',
            mobileBottomSheet &&
              'max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-lg font-semibold text-text-primary">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description
                  id={descriptionId}
                  className="mt-1 text-sm text-text-muted"
                >
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="rounded-md p-1 text-text-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </RadixDialog.Close>
          </div>

          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
