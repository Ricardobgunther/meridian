import { MailCheck } from 'lucide-react';

import { t } from '@/lib/i18n/t';
import type { InvitationRole } from '@/lib/types/api';

import { AcceptForm } from '../AcceptForm';
import type { ClientCardState } from '../cards-shared';

export interface AcceptReadyAuthedProps {
  token: string;
  orgName: string;
  role: InvitationRole;
  email: string;
  inviterName: string | null;
  onStateChange: (next: ClientCardState) => void;
}

/**
 * Card 3.1 — usuário autenticado, email confere. Mostra detalhes do
 * convite + botões "Recusar" / "Aceitar".
 */
export function AcceptReadyAuthed({
  token,
  orgName,
  role,
  email,
  inviterName,
  onStateChange,
}: AcceptReadyAuthedProps) {
  const roleLabel =
    role === 'admin'
      ? t.invitations.roles.adminFull
      : t.invitations.roles.memberFull;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft p-3"
        aria-hidden="true"
      >
        <MailCheck className="h-6 w-6 text-accent" />
      </span>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">
          {t.invitations.accept.readyTitlePrefix}
          <br />
          <strong>{orgName}</strong>
        </h1>
        <p className="text-sm text-text-muted">
          {inviterName
            ? t.invitations.accept.readySubtitle(roleLabel, inviterName)
            : t.invitations.accept.readySubtitleNoInviter(roleLabel)}
        </p>
      </div>

      <p className="w-full break-all rounded-sm border border-border bg-surface-sunken px-3 py-2 text-center font-mono text-sm text-text-muted">
        {t.invitations.accept.readyEmailLabel(email)}
      </p>

      <AcceptForm token={token} onStateChange={onStateChange} />
    </div>
  );
}
