import { t } from '@/lib/i18n/t';

/**
 * Skip-link visualmente escondido. Primeiro item focável do DOM — `Tab`
 * a partir do início da página revela o link. `href="#main-content"` mira
 * o `<main tabIndex={-1}>` do shell.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only-focusable absolute left-2 top-2 z-modal rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {t.shell.skipLink}
    </a>
  );
}
