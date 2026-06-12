'use client';

import {
  CalendarDays,
  MailPlus,
  Plus,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { useCurrentOrg } from '@/hooks/use-current-org';
import { useInvitations } from '@/hooks/use-invitations';
import { useMe } from '@/hooks/use-me';
import { useMembers } from '@/hooks/use-members';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';

import { DashboardSkeleton } from './DashboardSkeleton';
import { NoActiveOrgPanel, OrgErrorBanner } from './DashboardStates';
import { QuickActionCard } from './QuickActionCard';
import { StatCard } from './StatCard';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });

/** Saudação pelo relógio do dispositivo (spec 01 §3/§9). */
function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0] || undefined;
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t.dashboard.header.greetingMorning(first);
  if (hour >= 12 && hour < 18) {
    return t.dashboard.header.greetingAfternoon(first);
  }
  return t.dashboard.header.greetingEvening(first);
}

/**
 * Dashboard da org ativa: saudação, 4 stat cards e ações rápidas.
 * Genérico por design — produtos construídos no starter substituem esta
 * página. Estados por precedência: spec 01 §6.
 */
export function DashboardView() {
  const meQuery = useMe();
  const { orgId, membership, organization, isLoading, isError, refetch } =
    useCurrentOrg();
  const membersQuery = useMembers(orgId, { page: 1 });
  const invitationsQuery = useInvitations(orgId);
  const openModal = useUiStore((s) => s.openModal);

  // Estados 1–2: o Shell cobre (ShellLoading / ShellEmpty) — defensivo aqui.
  if (meQuery.isPending) return <DashboardSkeleton />;
  const memberships = meQuery.data?.memberships ?? [];
  if (memberships.length === 0) return null;

  // Estado 4 (rail defensivo): memberships existem mas nada resolveu.
  if (!orgId || !membership) {
    return (
      <NoActiveOrgPanel
        onCreate={() => openModal({ kind: 'create-org' })}
      />
    );
  }

  // Estado 3: org ativa ainda carregando.
  if (isLoading) return <DashboardSkeleton />;

  const userName = meQuery.data?.user.name ?? null;

  // Estado 5: erro ao carregar a org — saudação sem nome da org + banner.
  if (isError || !organization) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting(userName)}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t.dashboard.header.subtitleNoOrg}
          </p>
        </header>
        <OrgErrorBanner
          onRetry={() => {
            refetch();
            void membersQuery.refetch();
            void invitationsQuery.refetch();
          }}
        />
      </div>
    );
  }

  // Estado 6: sucesso. Counts têm loading/erro por card (spec 01 §4).
  const role = membership.role;
  const slug = membership.organization.slug;
  const canInvite = role === 'owner' || role === 'admin';
  const membersHref = `/org/${slug}/settings/members`;
  const membersTotal = membersQuery.data?.meta.total;
  const invitesTotal =
    invitationsQuery.data?.meta?.total ?? invitationsQuery.data?.data.length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">
          {greeting(userName)}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t.dashboard.header.subtitle(organization.name)}
        </p>
      </header>

      <section
        aria-labelledby="dashboard-overview-title"
        className="flex flex-col gap-4"
      >
        <h2
          id="dashboard-overview-title"
          className="text-lg font-semibold text-text-primary"
        >
          {t.dashboard.stats.sectionTitle}
        </h2>
        <div className="grid animate-fade-in grid-cols-1 gap-4 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label={t.dashboard.stats.members}
            value={
              membersTotal !== undefined
                ? numberFormatter.format(membersTotal)
                : null
            }
            href={membersHref}
            isError={membersQuery.isError}
            onRetry={() => void membersQuery.refetch()}
          />
          <StatCard
            icon={MailPlus}
            label={t.dashboard.stats.pendingInvites}
            value={
              invitesTotal !== undefined
                ? numberFormatter.format(invitesTotal)
                : null
            }
            href={membersHref}
            isError={invitationsQuery.isError}
            onRetry={() => void invitationsQuery.refetch()}
          />
          <StatCard
            icon={ShieldCheck}
            label={t.dashboard.stats.role}
            value={t.orgs.roleFull[role]}
          />
          <StatCard
            icon={CalendarDays}
            label={t.dashboard.stats.createdAt}
            value={dateFormatter.format(new Date(organization.created_at))}
          />
        </div>
      </section>

      <section
        aria-labelledby="dashboard-actions-title"
        className="flex flex-col gap-4"
      >
        <h2
          id="dashboard-actions-title"
          className="text-lg font-semibold text-text-primary"
        >
          {t.dashboard.actions.sectionTitle}
        </h2>
        <div className="grid animate-fade-in grid-cols-1 gap-4 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-3">
          {/* Navega para a página de membros (J3) — o InviteModal continua
              de posse exclusiva do MembersTab. Oculto (não desabilitado)
              para member. TODO: command palette global no futuro. */}
          {canInvite && (
            <QuickActionCard
              icon={UserPlus}
              title={t.dashboard.actions.inviteTitle}
              description={t.dashboard.actions.inviteDescription}
              href={membersHref}
            />
          )}
          <QuickActionCard
            icon={Settings}
            title={t.dashboard.actions.settingsTitle}
            description={t.dashboard.actions.settingsDescription}
            href={`/org/${slug}/settings`}
          />
          <QuickActionCard
            icon={Plus}
            title={t.dashboard.actions.createOrgTitle}
            description={t.dashboard.actions.createOrgDescription}
            onClick={() => openModal({ kind: 'create-org' })}
          />
        </div>
      </section>
    </div>
  );
}
