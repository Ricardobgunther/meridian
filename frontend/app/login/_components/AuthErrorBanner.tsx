'use client';

import { useEffect, useRef } from 'react';

import { AlertCircleIcon } from '@/app/_icons/AlertCircleIcon';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Não conseguimos entrar. Tente novamente.',
  access_denied: 'Você cancelou o login. Tente novamente quando quiser.',
  provider_disabled: 'Este provedor está temporariamente indisponível.',
};

const FALLBACK_MESSAGE = 'Algo deu errado no login. Tente novamente.';

export interface AuthErrorBannerProps {
  /** Código de erro retornado pelo callback (`oauth_failed`, `access_denied`...). */
  code: string;
}

/**
 * Faixa de erro inline, acessível. Recebe foco programático no mount para que
 * leitores de tela anunciem a mensagem assim que a página carrega com `?error=`.
 */
export function AuthErrorBanner({ code }: AuthErrorBannerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const message = ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
    >
      <AlertCircleIcon className="h-5 w-5 shrink-0 text-red-600" />
      <span>{message}</span>
    </div>
  );
}
