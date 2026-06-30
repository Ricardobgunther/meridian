import Link from 'next/link';
import { Mail } from 'lucide-react';

import { t } from '@/lib/i18n/t';

export interface AcceptReadyAnonProps {
  token: string;
  orgName: string;
  email: string;
}

/**
 * Card 3.2 — sem sessão. CTA leva ao login mantendo o token via
 * `?invite=`. O nome do inviter é deliberadamente omitido para
 * minimizar leak de dados a clientes anônimos.
 */
export function AcceptReadyAnon({
  token,
  orgName,
  email,
}: AcceptReadyAnonProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft p-3"
        aria-hidden="true"
      >
        <Mail className="h-6 w-6 text-accent" />
      </span>

      <h1 className="text-2xl font-bold text-text-primary">
        {t.invitations.accept.anonTitlePrefix}
        <br />
        <strong>{orgName}</strong>
      </h1>

      <p className="text-sm text-text-muted">
        {t.invitations.accept.anonBody(email)}
      </p>

      <Link
        href={`/login?invite=${encodeURIComponent(token)}`}
        className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors duration-fast ease-standard hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated motion-reduce:transition-none"
      >
        {t.invitations.accept.anonCta}
      </Link>

      <p className="text-xs text-text-disabled">
        {t.invitations.accept.anonHelper}
      </p>
    </div>
  );
}
