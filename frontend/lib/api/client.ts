import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { getCurrentOrgId } from '@/lib/org/current';
import { buildApiError } from '@/lib/api/errors';
import type { ApiError } from '@/lib/types/api';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
  /** Corpo JSON; serializado e Content-Type ajustado automaticamente. */
  json?: unknown;
  /** Query params em forma de objeto; valores nulos/undefined são ignorados. */
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Omite o X-Organization-Id (use em /me e /organizations list). */
  skipOrgHeader?: boolean;
  /** Em 401: tenta refresh; falhando, redireciona /login. Default true. */
  redirectOnAuthError?: boolean;
  /** Bearer override (usado pelo helper server-side). */
  accessToken?: string;
  /** Headers extras. */
  headers?: Record<string, string>;
}

function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_BASE_URL ??
    'http://localhost:8000';
  return base.replace(/\/$/, '');
}

function buildQueryString(
  query?: ApiFetchOptions['query'],
): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function getAccessTokenFromBrowser(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function tryRefreshSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

function redirectToLogin(reason: 'expired' | 'unauthenticated' = 'expired'): void {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.assign(`/login?reason=${reason}&next=${next}`);
}

async function parseResponseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  try {
    const text = await res.text();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

interface ExecuteOptions extends ApiFetchOptions {
  /** Token resolvido (browser ou server). */
  token: string | null;
}

async function executeFetch<T>(
  path: string,
  opts: ExecuteOptions,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}${buildQueryString(opts.query)}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };

  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  if (!opts.skipOrgHeader) {
    const orgId = getCurrentOrgId();
    if (orgId && UUID_REGEX.test(orgId)) {
      headers['X-Organization-Id'] = orgId;
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    signal: opts.signal,
    credentials: 'omit',
    cache: 'no-store',
  });

  if (res.ok) {
    const body = await parseResponseBody(res);
    return body as T;
  }

  const body = await parseResponseBody(res);
  const apiError = await buildApiError(res.status, body);
  throw apiError;
}

/**
 * Wrapper único para todas as chamadas à API Laravel.
 *
 * Auto:
 * - prefixa NEXT_PUBLIC_API_URL
 * - injeta Authorization (Supabase access token)
 * - injeta X-Organization-Id (a menos que `skipOrgHeader: true`)
 * - normaliza erros para `ApiError` (PT-BR já amigável)
 * - faz refresh + redirect-to-login no 401
 *
 * Use sempre — nunca chame `fetch` direto para a API.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  let token = opts.accessToken ?? null;
  if (!token && typeof window !== 'undefined') {
    token = await getAccessTokenFromBrowser();
  }

  try {
    return await executeFetch<T>(path, { ...opts, token });
  } catch (err) {
    const apiError = err as ApiError;
    const shouldHandle401 =
      apiError?.status === 401 && opts.redirectOnAuthError !== false;

    if (!shouldHandle401) throw err;

    // Tentativa única de refresh.
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      redirectToLogin('expired');
      throw err;
    }

    try {
      return await executeFetch<T>(path, { ...opts, token: refreshed });
    } catch (retryErr) {
      const retryApi = retryErr as ApiError;
      if (retryApi?.status === 401) {
        redirectToLogin('expired');
      }
      throw retryErr;
    }
  }
}

/**
 * Variante para Server Components: recebe o access_token explicitamente
 * (lido via `createClient()` do supabase/server e `auth.getSession()`).
 */
export function apiFetchServer<T = unknown>(
  path: string,
  accessToken: string,
  opts: Omit<ApiFetchOptions, 'accessToken' | 'redirectOnAuthError'> = {},
): Promise<T> {
  return apiFetch<T>(path, {
    ...opts,
    accessToken,
    redirectOnAuthError: false,
  });
}
