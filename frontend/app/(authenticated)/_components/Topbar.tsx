'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, Search, PanelLeftClose, PanelLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import type { Membership, User } from '@/lib/types/api';

interface TopbarProps {
  user: User;
  memberships: Membership[];
  currentOrgId: string | null;
}

/**
 * Topbar sticky com:
 * - botão drawer/toggle sidebar
 * - logo + wordmark
 * - OrgSwitcher (ou CTA "Criar organização" se nenhuma org)
 * - busca placeholder
 * - UserMenu
 *
 * Adiciona shadow quando a página rolou. Observer simples no body scroll.
 */
export function Topbar({ user, memberships, currentOrgId }: TopbarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileDrawer = useUiStore((s) => s.setMobileDrawer);

  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry?.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <header
        role="banner"
        className={cn(
          'sticky top-0 z-sticky flex h-14 w-full items-center gap-3 border-b border-border bg-surface px-4 lg:px-6',
          'transition-shadow duration-fast ease-standard motion-reduce:transition-none',
          scrolled && 'shadow-md',
        )}
      >
        {/* Mobile: drawer toggle */}
        <button
          type="button"
          aria-label={t.shell.sidebar.openDrawer}
          onClick={() => setMobileDrawer(true)}
          className="rounded-md p-2 text-text-muted hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Desktop: sidebar collapse toggle */}
        <button
          type="button"
          aria-label={
            collapsed
              ? t.shell.sidebar.expandLabel
              : t.shell.sidebar.collapseLabel
          }
          onClick={toggleSidebar}
          className="hidden rounded-md p-2 text-text-muted hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <span className="hidden text-sm font-semibold text-text-primary md:inline">
          {t.shell.topbar.brand}
        </span>

        <div className="mx-2 hidden h-6 w-px bg-border md:block" aria-hidden="true" />

        <OrgSwitcher
          memberships={memberships}
          currentOrgId={currentOrgId}
          showEmptyCta={memberships.length === 0}
        />

        {/* Search placeholder (em breve) */}
        <div className="ml-auto hidden max-w-sm flex-1 md:block">
          <div role="search" className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3 h-4 w-4 text-text-disabled"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder={t.shell.topbar.searchPlaceholder}
              aria-label={t.shell.topbar.searchLabel}
              aria-disabled="true"
              disabled
              className="h-9 w-full cursor-not-allowed rounded-md border border-border bg-surface-sunken pl-9 pr-3 text-sm text-text-muted placeholder:text-text-disabled"
            />
          </div>
        </div>

        <div className="ml-auto md:ml-2">
          <UserMenu
            email={user.email}
            name={user.name}
            avatarUrl={user.avatar_url}
            userId={user.id}
          />
        </div>
      </header>
    </>
  );
}
