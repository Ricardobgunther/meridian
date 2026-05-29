import type { Metadata } from 'next';

import { apiFetch } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/t';
import type { AcceptPreviewResponse } from '@/lib/types/api';

import { InviteLiveRegion } from './_components/InviteLiveRegion';
import {
  InvitePageView,
  type InitialState,
} from './_components/InvitePageView';

interface PageProps {
  params: { token: string };
}

export const dynamic = 'force-dynamic';

/**
 * Página pública /invite/[token] — Server Component.
 *
 * Resolve o estado inicial server-side (preview + sessão) e entrega o
 * markup do card já populado, sem flash. As ilhas client (`AcceptForm`,
 * `SignOutButton`) cuidam apenas das mutações.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const data = await loadPreview(params.token);
  if (data?.status === 'pending' && data.organization?.name) {
    return { title: t.invitations.accept.pageTitleWithOrg(data.organization.name) };
  }
  return { title: t.invitations.accept.pageTitleGeneric };
}

export default async function InvitePage({ params }: PageProps) {
  const token = params.token;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionEmail = user?.email ?? null;

  const payload = await loadPreview(token);
  const initial = resolveInitialState(payload, sessionEmail);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-surface px-4 py-12 focus:outline-none"
    >
      <InviteLiveRegion />

      <div
        aria-hidden="true"
        className="text-lg font-semibold tracking-tight text-text-primary"
      >
        Projeto1
      </div>

      <section className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-6 shadow-md md:p-8">
        <InvitePageView
          token={token}
          initial={initial}
          sessionEmail={sessionEmail}
        />
      </section>

      <p className="text-center text-xs text-text-muted">
        {t.invitations.accept.helpFooter}
      </p>
    </main>
  );
}

async function loadPreview(token: string) {
  try {
    const res = await apiFetch<AcceptPreviewResponse>(
      `/api/v1/invitations/accept/${encodeURIComponent(token)}`,
      { skipOrgHeader: true, redirectOnAuthError: false },
    );
    return res.data;
  } catch {
    // Em qualquer falha de rede / 5xx tratamos como "convite inválido" para
    // evitar enumeration; o usuário ainda vê uma CTA para a home.
    return null;
  }
}

function resolveInitialState(
  payload: Awaited<ReturnType<typeof loadPreview>>,
  sessionEmail: string | null,
): InitialState {
  if (!payload) return { kind: 'invalid' };

  switch (payload.status) {
    case 'pending': {
      // Match case-insensitive — emails são compared em lower no backend.
      if (sessionEmail) {
        if (sessionEmail.toLowerCase() === payload.email.toLowerCase()) {
          return { kind: 'ready-authed', preview: payload };
        }
        return {
          kind: 'wrong-email',
          preview: payload,
          connectedEmail: sessionEmail,
        };
      }
      return { kind: 'ready-anon', preview: payload };
    }
    case 'expired':
      return { kind: 'expired' };
    case 'revoked':
      return { kind: 'revoked' };
    case 'accepted':
      // Convite já consumido por outra sessão — UX equivale a "expired"
      // (não disponível). Mantemos resposta amistosa.
      return { kind: 'expired' };
    case 'not_found':
    default:
      return { kind: 'invalid' };
  }
}
