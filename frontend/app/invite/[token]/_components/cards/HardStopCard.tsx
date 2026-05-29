import Link from 'next/link';
import {
  Ban,
  CalendarX,
  CheckCircle2,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';

export type HardStopKind = 'expired' | 'revoked' | 'invalid' | 'accepted';

interface HardStopCardProps {
  kind: HardStopKind;
}

interface Variant {
  icon: LucideIcon;
  title: string;
  body: string;
  /**
   * `alert` for the negative terminal states (expired/revoked/invalid),
   * `status` for `accepted` — a positive outcome should be announced
   * politely, not as an assertive alert (spec 00-overview §6).
   */
  role: 'alert' | 'status';
  iconClassName: string;
  cta: { href: string; label: string };
}

const HOME_CTA = { href: '/', label: t.invitations.accept.goHome };

const VARIANTS: Record<HardStopKind, Variant> = {
  expired: {
    icon: CalendarX,
    title: t.invitations.accept.expiredTitle,
    body: t.invitations.accept.expiredBody,
    role: 'alert',
    iconClassName: 'text-text-muted',
    cta: HOME_CTA,
  },
  revoked: {
    icon: Ban,
    title: t.invitations.accept.revokedTitle,
    body: t.invitations.accept.revokedBody,
    role: 'alert',
    iconClassName: 'text-text-muted',
    cta: HOME_CTA,
  },
  invalid: {
    icon: HelpCircle,
    title: t.invitations.accept.invalidTitle,
    body: t.invitations.accept.invalidBody,
    role: 'alert',
    iconClassName: 'text-text-muted',
    cta: HOME_CTA,
  },
  accepted: {
    icon: CheckCircle2,
    title: t.invitations.accept.acceptedTitle,
    body: t.invitations.accept.acceptedBody,
    role: 'status',
    iconClassName: 'text-accent',
    // No org slug is available on an `accepted` preview (the backend
    // returns only `{ status }` for consumed invites), so the CTA points
    // at the app root, which routes an authed user into their workspace.
    cta: { href: '/', label: t.invitations.accept.acceptedCta },
  },
};

/**
 * Card "hard stop" reutilizado pelas variantes terminais 3.3 / 3.4 / 3.5 e
 * pela 3.6 (`accepted`, follow-up R9). `role` varia por variante: `alert`
 * para os estados negativos, `status` para o `accepted`.
 */
export function HardStopCard({ kind }: HardStopCardProps) {
  const variant = VARIANTS[kind];
  const Icon = variant.icon;

  return (
    <div
      role={variant.role}
      className="flex flex-col items-center gap-4 text-center"
    >
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-surface-sunken p-3"
        aria-hidden="true"
      >
        <Icon className={cn('h-6 w-6', variant.iconClassName)} />
      </span>

      <h1 className="text-xl font-semibold text-text-primary">
        {variant.title}
      </h1>
      <p className="text-sm text-text-muted">{variant.body}</p>

      <Link
        href={variant.cta.href}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-6 text-sm font-medium text-text-primary transition-colors duration-fast ease-standard hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated motion-reduce:transition-none"
      >
        {variant.cta.label}
      </Link>
    </div>
  );
}
