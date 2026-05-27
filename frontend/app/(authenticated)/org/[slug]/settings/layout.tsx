import type { ReactNode } from 'react';

import { SettingsTabs } from './_components/SettingsTabs';
import { t } from '@/lib/i18n/t';

interface SettingsLayoutProps {
  children: ReactNode;
  params: { slug: string };
}

/**
 * Layout do `/org/[slug]/settings/*`. Renderiza título, subtítulo e a barra
 * de abas; as rotas filhas (page.tsx, members/page.tsx) montam o conteúdo
 * de cada aba.
 */
export default function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">
          {t.settings.pageTitle}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t.settings.pageSubtitle}
        </p>
      </header>
      <SettingsTabs slug={params.slug} />
      <div>{children}</div>
    </div>
  );
}
