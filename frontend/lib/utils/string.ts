/**
 * Normaliza para busca acento-insensitiva: lowercase + remove diacríticos.
 * Usado pelo org switcher e busca de membros.
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Deriva um slug em kebab-case a partir de qualquer string.
 *
 * Regra (spec 03 §2.2):
 * 1. Lowercase
 * 2. Strip diacríticos
 * 3. Run de não-[a-z0-9] → '-'
 * 4. Trim '-' das pontas
 * 5. Truncate a `maxLen` (default 60)
 */
export function slugify(input: string, maxLen = 60): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(input: string): boolean {
  return SLUG_PATTERN.test(input);
}
