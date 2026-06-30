'use client';

import { useEffect } from 'react';

import { useUiStore } from '@/lib/stores/ui-store';

/**
 * Aplica data-theme em <html> baseado em useUiStore.theme.
 *
 * - 'light' / 'dark' → set direto.
 * - 'system' → segue prefers-color-scheme e atualiza ao vivo.
 *
 * Funciona em conjunto com o script inline em app/layout.tsx que evita FOUC
 * setando o data-theme antes do React hidratar.
 */
export function ThemeBoot(): null {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    function applyResolved(value: 'light' | 'dark') {
      root.setAttribute('data-theme', value);
    }

    if (theme === 'light' || theme === 'dark') {
      applyResolved(theme);
      return;
    }

    // system: segue a mídia query e re-aplica em mudanças do SO.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    applyResolved(media.matches ? 'dark' : 'light');

    const onChange = (e: MediaQueryListEvent) => {
      applyResolved(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return null;
}
