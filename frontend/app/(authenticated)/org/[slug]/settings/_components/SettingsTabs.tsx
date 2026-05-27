'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';

interface SettingsTabsProps {
  slug: string;
}

/**
 * Barra de abas para /org/[slug]/settings. Implementa o role="tablist"
 * manualmente porque usamos sub-rotas (Next) em vez de Radix Tabs.
 * Setas e Enter funcionam pelo comportamento nativo do <Link>.
 */
export function SettingsTabs({ slug }: SettingsTabsProps) {
  const pathname = usePathname();

  const tabs: Array<{ key: string; label: string; href: string }> = [
    {
      key: 'general',
      label: t.settings.tabs.general,
      href: `/org/${slug}/settings`,
    },
    {
      key: 'members',
      label: t.settings.tabs.members,
      href: `/org/${slug}/settings/members`,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t.settings.pageTitle}
      className="flex items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive =
          tab.key === 'general'
            ? pathname === tab.href
            : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            href={tab.href}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              isActive
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary',
              'motion-reduce:transition-none',
            )}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
