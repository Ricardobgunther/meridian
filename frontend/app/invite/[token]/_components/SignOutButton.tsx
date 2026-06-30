'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { createClient } from '@/lib/supabase/client';
import { parseApiError } from '@/lib/api/errors';
import { t } from '@/lib/i18n/t';

interface SignOutButtonProps {
  /** Token a preservar — após logout, vamos para /login?invite=<token>. */
  token: string;
}

/**
 * Botão usado no card "wrong-email": faz `supabase.auth.signOut()` e
 * navega para `/login?invite={token}` para o usuário re-autenticar com
 * o email correto.
 *
 * Comportamento de erro (follow-up R8): se o signOut falhar NÃO navegamos —
 * mostramos um `toast.error` e deixamos o usuário tentar de novo, igual ao
 * `UserMenu`/`LogoutButton`. Antes a navegação ficava num `finally` que
 * rodava mesmo na falha, então o hard reload descartava qualquer feedback.
 * O caminho de sucesso mantém o hard reload (`window.location.assign`) de
 * propósito — é a forma mais robusta de derrubar o singleton do client
 * Supabase e cookies stale — e, como nenhum toast é disparado no sucesso,
 * não há feedback a perder no reload.
 */
export function SignOutButton({ token }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      setLoading(false);
      const parsed = parseApiError(err);
      toast.error(parsed.title, { description: parsed.message });
      return;
    }

    window.location.assign(`/login?invite=${encodeURIComponent(token)}`);
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {loading
        ? t.invitations.accept.signingOut
        : t.invitations.accept.wrongEmailSignOut}
    </Button>
  );
}
