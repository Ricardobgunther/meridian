import { GithubIcon } from '@/app/_icons/GithubIcon';
import { GoogleIcon } from '@/app/_icons/GoogleIcon';

export type BadgeProvider = 'google' | 'github' | (string & {});

export interface ProviderBadgeProps {
  provider: BadgeProvider;
}

const BASE_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border';

/**
 * Badge identificando o provider que originou a sessão atual. Server-safe.
 */
export function ProviderBadge({ provider }: ProviderBadgeProps) {
  if (provider === 'github') {
    return (
      <span
        className={`${BASE_CLASSES} border-slate-800 bg-slate-900 text-white`}
      >
        <GithubIcon className="h-3.5 w-3.5" />
        GitHub
      </span>
    );
  }

  if (provider === 'google') {
    return (
      <span
        className={`${BASE_CLASSES} border-slate-200 bg-white text-slate-700`}
      >
        <GoogleIcon className="h-3.5 w-3.5" />
        Google
      </span>
    );
  }

  // Fallback genérico para providers ainda não mapeados.
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <span
      className={`${BASE_CLASSES} border-slate-200 bg-white text-slate-700`}
    >
      {label}
    </span>
  );
}
