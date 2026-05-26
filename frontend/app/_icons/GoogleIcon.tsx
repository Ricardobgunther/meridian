import type { SVGProps } from 'react';

export type GoogleIconProps = SVGProps<SVGSVGElement>;

/**
 * Logo Google oficial em SVG inline (não usa lucide). Decorativo por padrão:
 * passe `aria-hidden="true"` quando o texto adjacente já comunicar a ação.
 */
export function GoogleIcon(props: GoogleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.741 2.982-4.305 2.982-7.351Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.596-4.124H2.072v2.59A9.997 9.997 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H2.072A9.996 9.996 0 0 0 1 12c0 1.614.386 3.14 1.072 4.49l4.332-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.47 0 2.787.505 3.823 1.496l2.868-2.868C16.96 2.99 14.695 2 12 2 7.7 2 3.99 4.473 2.072 7.51l4.332 2.59C7.19 7.736 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  );
}
