import type { HTMLAttributes } from 'react';

export type SpinnerIconProps = HTMLAttributes<HTMLSpanElement> & {
  /** Classes Tailwind extras (ex.: tamanho). */
  className?: string;
};

/**
 * Spinner pequeno baseado em borda + animate-spin. Respeita `motion-reduce`.
 * Marcado como decorativo via `aria-hidden` — o estado é comunicado pelo label
 * adjacente ("Conectando…", "Saindo…") e por `aria-busy` no botão pai.
 */
export function SpinnerIcon({ className = '', ...rest }: SpinnerIconProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-block rounded-full border-2 border-current/30 border-t-current',
        'animate-spin motion-reduce:animate-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
