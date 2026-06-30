import type { Membership } from '@/lib/types/api';

const STORAGE_KEY = 'currentOrganizationId';
/**
 * Nome legado do cookie que esta camada escrevia. Nada lê hoje:
 * o backend resolve o org via header `X-Organization-Id` e nenhum
 * Server Component consulta cookie. Mantido apenas para expirar
 * cookies remanescentes de deploys anteriores.
 */
const LEGACY_COOKIE_NAME = 'current_organization_id';

/** Lê do localStorage. Em SSR retorna null. */
export function getCurrentOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persiste em localStorage. `localStorage` é a única fonte da verdade
 * no cliente — o servidor lê o org ativo do header da requisição.
 */
export function setCurrentOrgId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    clearLegacyCookie();
  } catch {
    // Storage indisponível (modo privado em alguns browsers) — silencioso.
  }
}

/** Expira qualquer cookie legado escrito por versões anteriores. */
function clearLegacyCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LEGACY_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Resolve o org ativo a partir das memberships do usuário.
 *
 * Lógica:
 * 1. Se há valor em storage e ele consta nas memberships → usa.
 * 2. Senão, primeiro da lista.
 * 3. Lista vazia → null e limpa storage.
 *
 * Sempre escreve o valor resolvido de volta (idempotente).
 */
export function resolveCurrentOrgId(memberships: Membership[]): string | null {
  const stored = getCurrentOrgId();
  if (stored && memberships.some((m) => m.organization.id === stored)) {
    setCurrentOrgId(stored);
    return stored;
  }
  const first = memberships[0]?.organization.id ?? null;
  setCurrentOrgId(first);
  return first;
}
