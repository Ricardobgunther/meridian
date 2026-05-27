'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Button, type ButtonVariant } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Habilita/desabilita o botão de confirmação. */
  confirmDisabled?: boolean;
  /** "danger" para ações destrutivas; default "primary". */
  variant?: Extract<ButtonVariant, 'primary' | 'danger'>;
  /** Conteúdo extra (input de confirmação, etc.) entre descrição e botões. */
  children?: ReactNode;
  /** Loading state — desabilita os dois botões e mostra aria-busy. */
  loading?: boolean;
}

/**
 * Diálogo genérico de confirmação. Foco inicial fica no botão Cancelar
 * (mais seguro) — caller pode mover via children + autoFocus.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmDisabled,
  variant = 'primary',
  children,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-overlay data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-modal flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface-elevated p-6 shadow-lg',
            'data-[state=open]:animate-scale-in motion-reduce:animate-none',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text-primary">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="rounded-md p-1 text-text-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {children && <div className="mb-4">{children}</div>}

          <div className="mt-2 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="max-sm:w-full"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant}
              onClick={() => void onConfirm()}
              disabled={confirmDisabled || loading}
              aria-busy={loading}
              className="max-sm:w-full"
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
