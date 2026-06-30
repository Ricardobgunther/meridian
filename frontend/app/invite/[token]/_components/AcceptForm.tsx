'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { parseApiError } from '@/lib/api/errors';
import { t } from '@/lib/i18n/t';
import { useAcceptInvitation } from '@/hooks/use-accept-invitation';
import { useDeclineInvitation } from '@/hooks/use-decline-invitation';

import type { ClientCardState } from './cards-shared';

export interface AcceptFormProps {
  token: string;
  /** Setter usado para trocar o card em caso de race (410/422). */
  onStateChange: (next: ClientCardState) => void;
}

/**
 * Ilha client que dispara Aceitar / Recusar. Renderiza dois botões
 * lado-a-lado (md+) ou empilhados (mobile, primary on top).
 *
 * Em erro 410 (token consumido) ou 422 com `invitation_email_mismatch`,
 * troca a renderização do card via `onStateChange` — a página pai escuta.
 */
export function AcceptForm({ token, onStateChange }: AcceptFormProps) {
  const acceptMutation = useAcceptInvitation(token);
  const declineMutation = useDeclineInvitation(token);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const accepting = acceptMutation.isPending;
  const declining = declineMutation.isPending;
  const busy = accepting || declining;

  async function handleAccept() {
    setInlineError(null);
    try {
      await acceptMutation.mutateAsync();
    } catch (err) {
      const parsed = parseApiError(err);
      // Race: token consumido / revogado / expirado entre preview e POST.
      if (parsed.status === 410 || parsed.status === 404) {
        const next: ClientCardState =
          parsed.domainCode === 'invitation_revoked' ? 'revoked' : 'expired';
        onStateChange(next);
        return;
      }
      if (parsed.domainCode === 'invitation_email_mismatch') {
        onStateChange('wrong-email');
        return;
      }
      if (parsed.domainCode === 'invitation_expired') {
        onStateChange('expired');
        return;
      }
      if (parsed.domainCode === 'invitation_revoked') {
        onStateChange('revoked');
        return;
      }
      setInlineError(parsed.message || t.invitations.accept.inlineErrorGeneric);
    }
  }

  async function handleDecline() {
    setInlineError(null);
    try {
      await declineMutation.mutateAsync();
    } catch (err) {
      const parsed = parseApiError(err);
      setInlineError(parsed.message || t.invitations.accept.inlineErrorGeneric);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {inlineError && (
        <div
          role="alert"
          className="rounded-sm border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <p className="font-medium">
            {t.invitations.accept.inlineErrorTitle}
          </p>
          <p>{inlineError}</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={handleDecline}
          disabled={busy}
          aria-busy={declining}
          className="max-sm:w-full"
        >
          {declining && <SpinnerIcon className="h-4 w-4" />}
          {declining ? t.invitations.accept.declining : t.invitations.accept.decline}
        </Button>
        <Button
          variant="primary"
          onClick={handleAccept}
          disabled={busy}
          aria-busy={accepting}
          className="max-sm:w-full"
        >
          {accepting && <SpinnerIcon className="h-4 w-4" />}
          {accepting ? t.invitations.accept.accepting : t.invitations.accept.accept}
        </Button>
      </div>
    </div>
  );
}
