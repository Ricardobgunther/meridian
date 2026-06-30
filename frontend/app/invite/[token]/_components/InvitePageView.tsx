'use client';

import { useState } from 'react';

import type {
  AcceptPreviewPending,
  InvitationRole,
} from '@/lib/types/api';

import { AcceptReadyAnon } from './cards/AcceptReadyAnon';
import { AcceptReadyAuthed } from './cards/AcceptReadyAuthed';
import { HardStopCard } from './cards/HardStopCard';
import { WrongEmailCard } from './cards/WrongEmailCard';
import type { ClientCardState } from './cards-shared';

export type InitialState =
  | { kind: 'ready-authed'; preview: AcceptPreviewPending }
  | { kind: 'ready-anon'; preview: AcceptPreviewPending }
  | { kind: 'wrong-email'; preview: AcceptPreviewPending; connectedEmail: string }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | { kind: 'invalid' }
  | { kind: 'accepted' };

interface InvitePageViewProps {
  token: string;
  initial: InitialState;
  /** Email da sessão (se houver). Necessário para o wrong-email guard. */
  sessionEmail: string | null;
}

/**
 * Cliente: recebe o estado inicial resolvido pelo Server Component e
 * monta o card correspondente. Mantém um estado override para trocar
 * de card quando o POST de aceite/recusa expõe uma race condition.
 */
export function InvitePageView({
  token,
  initial,
  sessionEmail,
}: InvitePageViewProps) {
  const [override, setOverride] = useState<ClientCardState | null>(null);

  if (override === 'expired') return <HardStopCard kind="expired" />;
  if (override === 'revoked') return <HardStopCard kind="revoked" />;
  if (override === 'invalid') return <HardStopCard kind="invalid" />;
  if (override === 'wrong-email') {
    const expected =
      initial.kind === 'ready-authed' || initial.kind === 'ready-anon'
        ? initial.preview.email
        : '';
    return (
      <WrongEmailCard
        token={token}
        connectedEmail={sessionEmail ?? ''}
        expectedEmail={expected}
      />
    );
  }

  switch (initial.kind) {
    case 'ready-authed': {
      const p = initial.preview;
      return (
        <AcceptReadyAuthed
          token={token}
          orgName={p.organization?.name ?? '—'}
          role={p.role as InvitationRole}
          email={p.email}
          inviterName={p.invited_by?.name ?? null}
          onStateChange={setOverride}
        />
      );
    }
    case 'ready-anon':
      return (
        <AcceptReadyAnon
          token={token}
          orgName={initial.preview.organization?.name ?? '—'}
          email={initial.preview.email}
        />
      );
    case 'wrong-email':
      return (
        <WrongEmailCard
          token={token}
          connectedEmail={initial.connectedEmail}
          expectedEmail={initial.preview.email}
        />
      );
    case 'expired':
      return <HardStopCard kind="expired" />;
    case 'revoked':
      return <HardStopCard kind="revoked" />;
    case 'invalid':
      return <HardStopCard kind="invalid" />;
    case 'accepted':
      return <HardStopCard kind="accepted" />;
  }
}
