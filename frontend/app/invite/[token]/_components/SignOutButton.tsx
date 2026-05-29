'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n/t';

interface SignOutButtonProps {
  /** Token a preservar — após logout, vamos para /login?invite=<token>. */
  token: string;
}

/**
 * Botão usado no card "wrong-email": faz `supabase.auth.signOut()` e
 * navega para `/login?invite={token}` para o usuário re-autenticar com
 * o email correto.
 */
export function SignOutButton({ token }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      // Mesmo se signOut falhar, manda para /login. O middleware vai
      // limpar o resto da sessão se ainda houver resíduo.
      window.location.assign(`/login?invite=${encodeURIComponent(token)}`);
    }
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
