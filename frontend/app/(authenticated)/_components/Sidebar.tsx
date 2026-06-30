'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  BookOpen,
  X,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';

interface SidebarProps {
  /** Slug da org ativa (para construir os hrefs). Null = nav desabilitada. */
  activeOrgSlug: string | null;
  /** Mobile drawer mode (renders inside Dialog). */
  mobile?: boolean;
  /** Callback quando um item é clicado (usado pelo drawer mobile para fechar). */
  onNavigate?: () => void;
}

interface NavItem {
  key: string;
  href: (slug: string) => string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    href: () => '/dashboard',
    label: t.shell.sidebar.nav.dashboard,
    icon: LayoutDashboard,
  },
  {
    key: 'members',
    href: (slug) => `/org/${slug}/settings/members`,
    label: t.shell.sidebar.nav.members,
    icon: Users,
  },
  {
    key: 'settings',
    href: (slug) => `/org/${slug}/settings`,
    label: t.shell.sidebar.nav.settings,
    icon: Settings,
  },
];

/**
 * Sidebar persistente (≥lg) ou drawer (<lg). Layout único — o pai decide
 * o container (aside fixa ou Dialog.Content).
 *
 * Quando `activeOrgSlug` é null, todos os links de-tenant ficam disabled
 * com tooltip "Selecione uma organização". Dashboard fica habilitado.
 */
export function Sidebar({ activeOrgSlug, mobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setMobileDrawer = useUiStore((s) => s.setMobileDrawer);
  const isCollapsed = !mobile && collapsed;

  return (
    <aside
      role="navigation"
      aria-label="Navegação principal"
      className={cn(
        'flex h-full flex-col gap-1 border-r border-border bg-surface',
        mobile ? 'w-72 p-3' : isCollapsed ? 'w-16 p-2' : 'w-60 p-3',
      )}
    >
      {mobile ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-text-primary">
            {t.shell.topbar.brand}
          </span>
          <button
            type="button"
            aria-label={t.shell.sidebar.closeDrawer}
            className="rounded-md p-1 text-text-muted hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setMobileDrawer(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Tooltip.Provider delayDuration={300}>
        <ul role="list" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const requiresOrg = item.key !== 'dashboard';
            const disabled = requiresOrg && !activeOrgSlug;
            const href = activeOrgSlug
              ? item.href(activeOrgSlug)
              : '/dashboard';
            const isActive =
              !disabled && pathname?.startsWith(href) && href !== '/dashboard'
                ? true
                : !disabled && pathname === href;

            const content = (
              <NavRow
                Icon={item.icon}
                label={item.label}
                isActive={Boolean(isActive)}
                disabled={disabled}
                collapsed={isCollapsed}
              />
            );

            const inner = disabled ? (
              <span
                aria-disabled="true"
                className="block cursor-not-allowed opacity-40"
              >
                {content}
              </span>
            ) : (
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className="block focus-visible:outline-none"
              >
                {content}
              </Link>
            );

            if (isCollapsed) {
              return (
                <li key={item.key}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>{inner}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="right"
                        sideOffset={8}
                        className="rounded-md bg-surface-elevated border border-border px-2 py-1 text-xs text-text-primary shadow-md z-dropdown"
                      >
                        {disabled ? t.shell.sidebar.needsOrg : item.label}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </li>
              );
            }

            return <li key={item.key}>{inner}</li>;
          })}
        </ul>
      </Tooltip.Provider>

      <div className="my-2 h-px bg-border" aria-hidden="true" />

      <a
        href="https://nextjs.org/docs"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors duration-fast ease-standard hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none',
          isCollapsed && 'justify-center px-2',
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!isCollapsed && (
          <span className="truncate">{t.shell.sidebar.nav.docs}</span>
        )}
      </a>
    </aside>
  );
}

interface NavRowProps {
  Icon: typeof LayoutDashboard;
  label: string;
  isActive: boolean;
  disabled: boolean;
  collapsed: boolean;
}

function NavRow({ Icon, label, isActive, disabled, collapsed }: NavRowProps) {
  return (
    <span
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-standard motion-reduce:transition-none',
        collapsed && 'justify-center px-2',
        isActive
          ? 'border-l-2 border-accent bg-accent-soft pl-[10px] font-medium text-accent'
          : 'text-text-muted hover:bg-surface-elevated hover:text-text-primary',
        disabled && 'pointer-events-none',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </span>
  );
}
