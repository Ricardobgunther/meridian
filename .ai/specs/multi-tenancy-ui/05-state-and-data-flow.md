# 05 — Client State & Data Flow

Spec status: Architecture for the client-side data layer of the multi-tenancy UI. Frontend-agent uses this as the canonical reference for query keys, mutations, store shape, and API wrapping.

References:
- ADR-006 (TanStack Query for server state)
- ADR-003 (Zustand for UI state)
- ADR-009 (`X-Organization-Id` header)
- ADR-011 (`users.id = auth.uid()`)

---

## 1. TanStack Query — query keys and conventions

### Key map

| Resource | Key | Endpoint | staleTime |
|---|---|---|---|
| Current user + memberships | `['me']` | `GET /api/v1/me` | `5 * 60_000` (5 min) |
| Org list (user's orgs) | `['organizations']` | `GET /api/v1/organizations` | `60_000` (1 min) |
| Single org | `['organization', orgId]` | `GET /api/v1/organizations/{id}` | `60_000` |
| Members of an org (paginated, filterable) | `['organization', orgId, 'members', { page, q, role }]` | `GET /api/v1/organizations/{id}/members` | `30_000` |

**Note on `['me']` shape**: the response already bundles `data` (user) AND `memberships`. The query function should return the whole envelope; consumers read `meQuery.data.data` for user and `meQuery.data.memberships` for memberships. Alternatively, the query function destructures and returns a flatter `{ user, memberships }`. Spec recommends the flatter shape for ergonomics.

### Defaults (set in `QueryClient` constructor)

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: 'always',  // refetch when user returns to tab — important for role/membership changes
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        // Don't retry on 4xx (except 408/429) — they're client errors, no point
        const status = (error as ApiError)?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
```

### Invalidation rules

| Action | Invalidate |
|---|---|
| Switch active org (localStorage write) | `queryClient.invalidateQueries()` — full cache wipe; we're effectively a different tenant now |
| Create org (POST /organizations 201) | `['me']`, `['organizations']` |
| Update org (PATCH /organizations/{id}) | `['organization', orgId]`, `['organizations']`, `['me']` (if name/slug changed — they show in switcher) |
| Delete org | `['organizations']`, `['me']`; then localStorage cleanup + redirect |
| Add member (POST .../members) | `['organization', orgId, 'members']` (all variants), and `['me']` if the user added is the viewer (unlikely) |
| Update member role (PATCH .../members/{m}) | `['organization', orgId, 'members']` |
| Remove member (DELETE .../members/{m}) | `['organization', orgId, 'members']` |

> Variant invalidation: `queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'members'] })` matches all paginated/filtered variants since they share the prefix.

### Hooks (file naming convention `hooks/use-*.ts`)

```
hooks/
  use-me.ts                  → useMe()
  use-organizations.ts       → useOrganizations()
  use-organization.ts        → useOrganization(orgId)
  use-members.ts             → useMembers(orgId, { page, q, role })
  use-create-org.ts          → useCreateOrg()
  use-update-org.ts          → useUpdateOrg(orgId)
  use-delete-org.ts          → useDeleteOrg(orgId)
  use-update-member.ts       → useUpdateMember(orgId, memberId)
  use-remove-member.ts       → useRemoveMember(orgId, memberId)
  use-switch-org.ts          → useSwitchOrg()
```

Each hook ≤ 100 lines per project convention.

### Optimistic update pattern (for role change and member removal)

```ts
// use-update-member.ts (abridged)
return useMutation({
  mutationFn: ({ role }) => apiFetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    json: { role },
  }),
  onMutate: async ({ role }) => {
    await queryClient.cancelQueries({ queryKey: ['organization', orgId, 'members'] });
    const snapshots = queryClient.getQueriesData<MemberListResponse>({
      queryKey: ['organization', orgId, 'members'],
    });
    queryClient.setQueriesData<MemberListResponse>(
      { queryKey: ['organization', orgId, 'members'] },
      (old) => old && {
        ...old,
        data: old.data.map((m) => (m.id === memberId ? { ...m, role } : m)),
      },
    );
    return { snapshots };
  },
  onError: (_e, _v, ctx) => {
    ctx?.snapshots.forEach(([key, snap]) => queryClient.setQueryData(key, snap));
    toast.error('Não foi possível atualizar a função.');
  },
  onSuccess: () => {
    toast.success('Função atualizada.');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'members'] });
  },
});
```

---

## 2. Zustand — UI state store

Single store: `useUiStore` in `lib/stores/ui-store.ts`. Persists to localStorage (zustand persist middleware) with a small allowlist.

### Shape

```ts
type Theme = 'light' | 'dark' | 'system';

interface UiState {
  // Sidebar
  sidebarCollapsed: boolean;       // desktop ≥ lg: collapsed = icon-only
  mobileDrawerOpen: boolean;       // < lg: drawer slide-in

  // Theme
  theme: Theme;
  // Resolved theme respecting `system` — derived, not stored. Computed via getter.

  // Modals (single active modal at a time; nested = forbidden)
  activeModal:
    | null
    | { kind: 'create-org' }
    | { kind: 'confirm-delete-org'; orgId: string }
    | { kind: 'confirm-remove-member'; memberId: string }
    | { kind: 'confirm-role-promote-owner'; memberId: string; targetName: string }
    | { kind: 'confirm-slug-change'; oldSlug: string; newSlug: string };

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileDrawer: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  openModal: (m: NonNullable<UiState['activeModal']>) => void;
  closeModal: () => void;
}
```

Persist allowlist: `sidebarCollapsed`, `theme`. (Do NOT persist `mobileDrawerOpen` or `activeModal`.)

### Theme application

A small `<ThemeBoot>` component (mounted once in `<Shell>` or root `layout.tsx`) reads `theme` and:
- If `light` → sets `<html data-theme="light">`.
- If `dark` → sets `<html data-theme="dark">`.
- If `system` → reads `window.matchMedia('(prefers-color-scheme: dark)')`, sets accordingly, AND subscribes to changes.

To avoid FOUC: add a tiny inline script in `app/layout.tsx` (before React hydrates) that reads `localStorage` and sets `data-theme` before paint. Pattern is well-known; frontend-agent will implement.

---

## 3. API client wrapper

Single fetch wrapper for all calls. Lives at `lib/api/client.ts`.

### Contract

```ts
type ApiError = {
  status: number;
  code: 'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'server' | 'network' | 'unknown';
  // PT-BR message, UI-safe (i.e. already friendly):
  message: string;
  // For 422 from Form Requests: field errors map.
  fieldErrors?: Record<string, string[]>;
};

export async function apiFetch<T = unknown>(
  path: string,
  opts?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
    json?: unknown;
    signal?: AbortSignal;
    // When true, omits the X-Organization-Id header even if a current org is set.
    // Used for endpoints that don't need it (`/api/v1/me`, `/api/v1/organizations` listing).
    skipOrgHeader?: boolean;
    // When true, redirects to /login on 401 instead of returning an error.
    // Defaults to true for safety.
    redirectOnAuthError?: boolean;
  },
): Promise<T>;
```

### Behavior

1. **URL**: prefixed with `process.env.NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000`).
2. **Headers (auto-injected)**:
   - `Accept: application/json`
   - `Content-Type: application/json` when `json` is provided
   - `Authorization: Bearer ${supabaseAccessToken}` — token comes from the Supabase client (`supabase.auth.getSession()`). On the server, use `@supabase/ssr`'s server client; on the browser, use the browser client. Frontend-agent picks the right one based on context.
   - `X-Organization-Id: ${localStorage.getItem('currentOrganizationId')}` — set ONLY when:
     - `opts.skipOrgHeader !== true`
     - The value is a non-empty UUID
3. **Body**: if `json` provided, `JSON.stringify(json)`. Otherwise no body.
4. **Response parsing**:
   - 204 No Content → return `undefined as T`.
   - `Content-Type: application/json` → parse and return.
   - Other → throw a network-shaped error.
5. **Error normalization**: on non-2xx, throw an `ApiError` shape (see §4). Never expose a raw Response or fetch reject to consumers.
6. **401 handling**: if `redirectOnAuthError !== false`, attempt a Supabase token refresh once. If still 401, redirect to `/login?reason=expired`. Otherwise throw.
7. **Abort**: pass `opts.signal` through to fetch.

### Server-side use (Server Components, Route Handlers)

Same `apiFetch`, but the Supabase token comes from cookies via `@supabase/ssr` server client. Wrap in a small helper `apiFetchServer<T>(path, opts)` that reads cookies and constructs the auth header.

---

## 4. Error normalization — `parseApiError`

Single helper in `lib/api/errors.ts`.

```ts
export function parseApiError(err: unknown): {
  title: string;        // PT-BR, short — for toast title or banner heading
  message: string;      // PT-BR, longer — for toast description or banner body
  fieldErrors?: Record<string, string>;  // first error per field, ready for form display
};
```

### Mapping table

| Server response | title | message | fieldErrors |
|---|---|---|---|
| 2xx (shouldn't reach this) | — | — | — |
| 400 with `{error: "..."}` | "Solicitação inválida" | `body.error` | — |
| 401 (shouldn't reach UI — wrapper redirects) | "Sessão expirada" | "Faça login novamente." | — |
| 403 with `{error: "..."}` | "Sem permissão" | `body.error` | — |
| 404 with `{error: "..."}` | "Não encontrado" | `body.error` | — |
| 422 Laravel `{message, errors}` | "Verifique os campos" | `body.message` (PT-BR if app is localized) | `Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]]))` |
| 422 app-shaped `{error: "..."}` | "Verifique os dados" | `body.error` | — |
| 429 | "Muitas tentativas" | "Aguarde alguns instantes e tente novamente." | — |
| 5xx | "Erro inesperado" | "Algo deu errado do nosso lado. Tente novamente em instantes." | — |
| Network failure (TypeError from fetch) | "Sem conexão" | "Verifique sua internet e tente novamente." | — |
| Anything else | "Algo deu errado" | "Não foi possível concluir a ação. Tente novamente." | — |

> Wrapper-thrown `ApiError.message` is already passed through this mapping; `parseApiError` re-formats for display layer (toast vs banner vs inline). Components never read raw HTTP responses.

---

## 5. Active org resolution helper

`lib/org/current.ts`:

```ts
export function getCurrentOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentOrganizationId');
}

export function setCurrentOrgId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem('currentOrganizationId', id);
  else localStorage.removeItem('currentOrganizationId');
}

// Resolves from me.memberships, with fallback to first membership.
export function resolveCurrentOrgId(
  memberships: Membership[],
): string | null {
  const stored = getCurrentOrgId();
  if (stored && memberships.some((m) => m.organization.id === stored)) return stored;
  const first = memberships[0]?.organization.id ?? null;
  if (first) setCurrentOrgId(first);
  else setCurrentOrgId(null);
  return first;
}
```

On the server, `getCurrentOrgId()` returns `null` because localStorage doesn't exist. Server Components that need the active org must either:
- Read it from a cookie (the client can mirror localStorage → cookie via `useEffect`), OR
- Defer org-scoped data fetches to client components.

**Spec recommendation**: mirror to a cookie named `current_organization_id` (HttpOnly: false, Path: `/`, SameSite: Lax) via a small `useEffect` in `<Shell>`. Server Components read the cookie. Trade-off: small extra write per org switch.

---

## 6. Toast system

Use `sonner` or a Radix Toast wrapper. Mounted once at the root (`<Toaster>` in `app/layout.tsx`). API:

```ts
toast.success(title, { description? })
toast.error(title, { description? })
toast.info(title, { description? })
```

- `role="status"` for success/info, `role="alert"` for error.
- Top-right on desktop, top-center on mobile.
- `z-toast` from token spec.
- Auto-dismiss 4s (success/info) or 6s (error). Manual dismiss button always present.
- Stacking: max 3 visible; older fade out.

---

## 7. End-to-end flow examples

### Example A: User switches org from switcher

```
1. User clicks row "Globex SaaS" in panel.
2. useSwitchOrg().mutate(newOrgId):
   a. setCurrentOrgId(newOrgId)
   b. set cookie current_organization_id = newOrgId
   c. queryClient.invalidateQueries()  ← full wipe
   d. router.refresh()
3. Switcher panel closes; trigger now shows "Globex SaaS".
4. Server re-renders shell with new org-scoped data; client refetches anything still needed.
5. aria-live announces "Organização trocada para Globex SaaS."
```

### Example B: User creates first org (was in empty state)

```
1. User clicks "+ Criar organização".
2. uiStore.openModal({ kind: 'create-org' }).
3. Modal mounts (spec 03), focuses name field.
4. User fills, clicks Criar.
5. useCreateOrg().mutate({ name, slug }):
   a. POST /api/v1/organizations
   b. Success → setCurrentOrgId(newOrg.id), cookie write
   c. invalidate ['me'], ['organizations']
   d. uiStore.closeModal()
   e. toast.success('Organização criada')
   f. router.push('/dashboard') + router.refresh()
6. Empty state unmounts, normal shell appears.
```

### Example C: Member tries to PATCH a field they can't edit

UI shouldn't allow this — but if a stale state lets through:

```
1. Form submits → 403 from server.
2. apiFetch throws ApiError { status: 403, message: "Apenas administradores podem editar." }.
3. Form's onError catches → parseApiError → toast.error(title, { description }).
4. Form re-enables, no field errors.
```

---

## 8. Type contracts (TypeScript types frontend-agent will create)

```ts
// lib/types/api.ts
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

export interface Membership {
  id: string;
  role: Role;
  joined_at: string;
  organization: Pick<Organization, 'id' | 'slug' | 'name'> & {
    your_role?: Role;
  };
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatar_url'>;
}

export interface MeResponse {
  data: User;
  memberships: Membership[];
}

export interface ApiListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  links?: { first: string; last: string; prev: string | null; next: string | null };
  meta: ApiListMeta;
}
```

---

## 9. Open judgment calls

- **localStorage vs cookie for currentOrganizationId**: spec uses BOTH. localStorage is canonical (synchronous, cheap), cookie is mirror for SSR. Could go cookie-only, but loses sync access in client hooks. Could go localStorage-only, but loses SSR data. Picking both as the safer default.
- **Flat `useMe()` return (`{user, memberships}`) vs envelope (`{data, memberships}`)**: chose flat for ergonomics. Trade-off: divergence from raw API shape.
- **Toast lib**: `sonner` recommended for DX; Radix Toast also viable. Frontend-agent picks at implementation time.
- **5-min staleTime on `['me']`**: generous because `me` rarely changes. If join-org or accept-invite flows become common, drop to 60s.
