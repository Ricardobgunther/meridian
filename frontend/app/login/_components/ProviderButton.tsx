'use client';

import { useState, type ReactNode } from 'react';

import { createClient } from '@/lib/supabase/client';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';

export type OAuthProvider = 'google' | 'github';

export interface ProviderButtonProps {
  provider: OAuthProvider;
  label: string;
  loadingLabel?: string;
  icon: ReactNode;
  /** Classes Tailwind do visual do botão (definidas pelo pai). */
  className: string;
  /** Callback opcional para reportar erro ao orquestrador (ex.: LoginCard). */
  onError?: (message: string) => void;
  /** Token de convite a propagar para o callback (?invite=). */
  inviteToken?: string | null;
}

/**
 * Botão que dispara `signInWithOAuth` do Supabase para um provider específico.
 * Mantém estado local de loading e troca o label para "Conectando…".
 */
export function ProviderButton({
  provider,
  label,
  loadingLabel = 'Conectando…',
  icon,
  className,
  onError,
  inviteToken,
}: ProviderButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL ?? '';
      // Propaga ?invite=... para que o callback redirecione direto à
      // página de aceite após o OAuth, em vez de aterrissar em /me.
      const inviteQuery = inviteToken
        ? `&invite=${encodeURIComponent(inviteToken)}`
        : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=/me${inviteQuery}`,
        },
      });
      if (error) {
        setLoading(false);
        onError?.('Não conseguimos iniciar o login. Tente novamente.');
      }
      // Em sucesso, o navegador é redirecionado pelo Supabase.
    } catch {
      setLoading(false);
      onError?.('Não conseguimos iniciar o login. Tente novamente.');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={className}
    >
      {loading ? (
        <SpinnerIcon className="h-4 w-4 shrink-0" />
      ) : (
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}
