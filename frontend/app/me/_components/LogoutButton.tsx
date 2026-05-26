'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';

const BUTTON_CLASSES =
  'inline-flex items-center gap-1.5 h-9 px-2 rounded-md bg-transparent text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

export interface LogoutButtonProps {
  /** Callback opcional para reportar erros ao container pai. */
  onError?: (message: string) => void;
}

/**
 * Botão "Sair". Faz `signOut` no cliente (limpa cookies via @supabase/ssr) e
 * navega para `/login`. Loading state troca o label para "Saindo…".
 */
export function LogoutButton({ onError }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setLoading(false);
        onError?.('Não conseguimos sair. Tente novamente.');
        return;
      }
      router.push('/login');
      router.refresh();
    } catch {
      setLoading(false);
      onError?.('Não conseguimos sair. Tente novamente.');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={BUTTON_CLASSES}
    >
      {loading ? <SpinnerIcon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span>{loading ? 'Saindo…' : 'Sair'}</span>
    </button>
  );
}
