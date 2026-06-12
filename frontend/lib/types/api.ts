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

// ── Invitations ─────────────────────────────────────────────────────────

/** Role concedível por convite — `owner` nunca é ofertado. */
export type InvitationRole = Exclude<Role, 'owner'>;

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface InvitationInviter {
  id: string;
  name: string | null;
  email: string;
  is_active_member: boolean;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  resent_at: string | null;
  invited_by: InvitationInviter | null;
}

/** Resposta de GET /api/v1/invitations (Laravel ResourceCollection). */
export interface InvitationsListResponse {
  data: Invitation[];
  links?: ApiListLinks;
  meta?: ApiListMeta;
}

/**
 * Preview público (GET /api/v1/invitations/accept, token no header
 * X-Invitation-Token — R10).
 *
 * O backend retorna `{ data: <payload> }`; o payload é um union discriminado
 * por `status`. Status `pending` carrega os detalhes; os demais são
 * intencionalmente magros para evitar enumeration via response shape.
 */
export interface AcceptPreviewPending {
  status: 'pending';
  email: string;
  role: InvitationRole;
  expires_at: string;
  organization: { id: string; slug: string; name: string } | null;
  invited_by: { name: string | null } | null;
}

export type AcceptPreviewPayload =
  | AcceptPreviewPending
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'not_found' }
  | { status: 'accepted' };

export interface AcceptPreviewResponse {
  data: AcceptPreviewPayload;
}

/** POST /api/v1/invitations/accept (token no header X-Invitation-Token) — sucesso. */
export interface AcceptResponse {
  data: {
    membership: Membership;
    organization: { id: string; slug: string; name: string } | null;
    role: InvitationRole;
  };
}

// ── Slug availability (GET /api/v1/organizations/check-slug) ───────────

/** Resposta advisory — o 422 do POST /organizations segue sendo a verdade. */
export interface SlugCheckResponse {
  data: {
    slug: string;
    available: boolean;
  };
}

export type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'taken';

// POST /organizations/{id}/leave → 204, sem body. Use apiFetch<void>.
