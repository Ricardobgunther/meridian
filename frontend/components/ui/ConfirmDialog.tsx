'use client';

import type { ReactNode } from 'react';

import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';

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
 * Diálogo de confirmação. Compõe o `Dialog` base e adiciona dois botões:
 * Cancelar (variant secondary, foco-default seguro) + ação principal.
 *
 * Para um Dialog "puro" (sem CTAs prontas) — ex.: form de criação — use
 * `<Dialog>` diretamente.
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      {children ? <div className="mb-4">{children}</div> : null}

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
    </Dialog>
  );
}
