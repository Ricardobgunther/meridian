import Link from 'next/link';
import { Ban, CalendarX, HelpCircle, type LucideIcon } from 'lucide-react';

import { t } from '@/lib/i18n/t';

export type HardStopKind = 'expired' | 'revoked' | 'invalid';

interface HardStopCardProps {
  kind: HardStopKind;
}

interface Variant {
  icon: LucideIcon;
  title: string;
  body: string;
}

const VARIANTS: Record<HardStopKind, Variant> = {
  expired: {
    icon: CalendarX,
    title: t.invitations.accept.expiredTitle,
    body: t.invitations.accept.expiredBody,
  },
  revoked: {
    icon: Ban,
    title: t.invitations.accept.revokedTitle,
    body: t.invitations.accept.revokedBody,
  },
  invalid: {
    icon: HelpCircle,
    title: t.invitations.accept.invalidTitle,
    body: t.invitations.accept.invalidBody,
  },
};

/**
 * Card "hard stop" reutilizado pelas variantes 3.3 / 3.4 / 3.5. `role=alert`
 * para anunciar imediatamente o estado terminal ao SR.
 */
export function HardStopCard({ kind }: HardStopCardProps) {
  const variant = VARIANTS[kind];
  const Icon = variant.icon;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 text-center"
    >
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-surface-sunken p-3"
        aria-hidden="true"
      >
        <Icon className="h-6 w-6 text-text-muted" />
      </span>

      <h1 className="text-xl font-semibold text-text-primary">
        {variant.title}
      </h1>
      <p className="text-sm text-text-muted">{variant.body}</p>

      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-6 text-sm font-medium text-text-primary transition-colors duration-fast ease-standard hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated motion-reduce:transition-none"
      >
        {t.invitations.accept.goHome}
      </Link>
    </div>
  );
}
