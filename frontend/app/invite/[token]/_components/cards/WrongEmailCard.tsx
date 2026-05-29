import { UserX } from 'lucide-react';

import { t } from '@/lib/i18n/t';

import { SignOutButton } from '../SignOutButton';

interface WrongEmailCardProps {
  token: string;
  connectedEmail: string;
  expectedEmail: string;
}

/**
 * Card 3.6 — usuário autenticado, mas email da sessão ≠ email do convite.
 *
 * `role=alert` + ícone warning (cor com contraste reforçado: a combinação
 * `text-warning` × `bg-warning-soft` falha contraste WCAG; aplicamos uma
 * sombra HSL mais escura via classe arbitrária — delta uiux §5.2).
 *
 * O sign-out é deliberadamente manual: não forçamos logout automático.
 */
export function WrongEmailCard({
  token,
  connectedEmail,
  expectedEmail,
}: WrongEmailCardProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 text-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-warning-soft p-3"
        aria-hidden="true"
      >
        <UserX className="h-6 w-6 text-[hsl(38_92%_35%)]" />
      </span>

      <h1 className="text-xl font-semibold text-text-primary">
        {t.invitations.accept.wrongEmailTitle}
      </h1>

      <p className="text-sm text-text-muted">
        {t.invitations.accept.wrongEmailConnectedAs('')}
        <strong className="block break-all font-mono text-text-primary">
          {connectedEmail}
        </strong>
      </p>

      <p className="text-sm text-text-muted">
        {t.invitations.accept.wrongEmailExpected('')}
        <strong className="block break-all font-mono text-text-primary">
          {expectedEmail}
        </strong>
      </p>

      <SignOutButton token={token} />
    </div>
  );
}
