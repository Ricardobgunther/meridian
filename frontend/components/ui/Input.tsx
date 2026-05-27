import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const baseClasses =
  'block w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary ' +
  'placeholder:text-text-disabled ' +
  'transition-colors duration-fast ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ' +
  'focus-visible:border-transparent ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-sunken ' +
  'motion-reduce:transition-none';

/**
 * Input padrão. Use `invalid` em vez de mexer em classes manualmente —
 * setá-lo aplica a borda danger e prepara para `aria-invalid` no caller.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        baseClasses,
        invalid
          ? 'border-danger focus-visible:ring-danger'
          : 'border-border hover:border-border-strong',
        className,
      )}
      aria-invalid={invalid ? true : undefined}
      {...rest}
    />
  );
});
