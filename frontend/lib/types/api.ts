/**
 * Tipos das respostas da API Laravel.
 *
 * Backend wrap em `{ data: ... }` para single resource e
 * `{ data: [...], links, meta }` para coleções (Laravel ResourceCollection).
 *
 * Mantenha em sincronia com `backend/app/Http/Resources/*.php`.
 */

export type Role = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  locale: string | null;
  timezone: string | null;
  last_seen_at: string | null;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
  your_role: Role | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationLite {
  id: string;
  slug: string;
  name: string;
  your_role?: Role;
}

export interface Membership {
  id: string;
  role: Role;
  joined_at: string;
  organization: OrganizationLite;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatar_url'>;
}

/** Resposta de GET /api/v1/me — user vem em `data`, memberships à parte. */
export interface MeApiEnvelope {
  data: User;
  memberships: Membership[];
}

/** Forma simplificada usada pelos hooks (`useMe()` retorna isto). */
export interface MeResponse {
  user: User;
  memberships: Membership[];
}

export interface ApiListLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface ApiListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
}

export interface Paginated<T> {
  data: T[];
  links?: ApiListLinks;
  meta: ApiListMeta;
}

export interface SingleResource<T> {
  data: T;
}

/** Erro normalizado lançado por `apiFetch` em qualquer não-2xx. */
export type ApiErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'unknown';

export interface ApiError {
  status: number;
  code: ApiErrorCode;
  /** Mensagem PT-BR pronta para exibição (já amigável). */
  message: string;
  /** Erros por campo (422 Laravel). Primeira mensagem por campo. */
  fieldErrors?: Record<string, string[]>;
  /** Body bruto da resposta para diagnóstico (não exibir). */
  raw?: unknown;
}
