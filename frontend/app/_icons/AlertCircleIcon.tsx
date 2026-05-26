import type { SVGProps } from 'react';

export type AlertCircleIconProps = SVGProps<SVGSVGElement>;

/**
 * Ícone de alerta circular em SVG inline. Usa `currentColor` para herdar a cor do texto.
 */
export function AlertCircleIcon(props: AlertCircleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
