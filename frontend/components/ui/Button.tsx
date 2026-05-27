import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-soft';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-fast ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'motion-reduce:transition-none';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9 p-0',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  secondary:
    'border border-border bg-surface text-text-primary hover:bg-surface-sunken',
  ghost: 'bg-transparent text-text-primary hover:bg-surface-elevated',
  danger: 'bg-danger text-white hover:bg-danger/90',
  'danger-soft':
    'bg-danger-soft text-danger hover:bg-danger-soft/70 border border-danger/30',
};

/**
 * Botão genérico do design system. Sempre passe um `aria-label` em variantes
 * `icon` (não há texto). Para estados de loading, gerencie no caller setando
 * `disabled + aria-busy` e um spinner como filho.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...rest}
      />
    );
  },
);
