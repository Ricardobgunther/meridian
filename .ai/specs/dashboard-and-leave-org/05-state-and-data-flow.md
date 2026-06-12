# 05 — Client State & Data Flow

Spec status: Data-layer reference for this block. Extends (never contradicts) `multi-tenancy-ui/05-state-and-data-flow.md` — query-key conventions, `apiFetch`, `parseApiError`, `lib/org/current.ts` and the `QueryClient` defaults all carry over unchanged.

---

## 1. Endpoints consumed

| Endpoint | Used by | Notes |
|---|---|---|
| `GET /api/v1/me` | dashboard greeting, active-org resolution | existing `useMe()` |
| `GET /api/v1/organizations/{id}` | dashboard (name, `created_at`, `your_role`) | existing `useOrganization(orgId)` |
| `GET /api/v1/organizations/{id}/members` (page 1) | dashboard members count (`meta.total`) | existing `useMembers(orgId, { page: 1 })` — note the path is `/members`, not `/memberships` |
| `GET /api/v1/invitations` | dashboard pending count (`meta.total`) | existing `useInvitations(orgId)`; backend defaults to `status=pending`, org via `X-Organization-Id` |
| `POST /api/v1/organizations/{id}/leave` | leave flow | **NEW** (overview D1), 204 on success |
| `GET /api/v1/organizations/check-slug?slug=…` | slug preview | **NEW** (overview D2), `skipOrgHeader: true` (no tenant context) |

No new aggregate/stats endpoint (overview J5).

---

## 2. Query keys & new hooks

### Key map additions

| Resource | Key | staleTime | enabled |
|---|---|---|---|
| Slug availability | `['slug-check', slug]` | `30_000` | slug matches pattern, length 3–60 |

Counts reuse the existing keys (`['organization', orgId, 'members', {…}]`, `['invitations', orgId]`) — deliberate: navigating from a dashboard card to the members page hits a warm cache.

### `hooks/use-current-org.ts` → `useCurrentOrg()` (NEW)

The dashboard has no `[slug]` segment, so it can't use `useActiveOrg(slug)`. Extract the resolution `Shell.tsx` already performs into a shared hook:

```ts
interface UseCurrentOrgResult {
  orgId: string | null;          // getCurrentOrgId(), validated against memberships
  membership: Membership | null; // from useMe()
  organization: Organization | null; // from useOrganization(orgId)
  role: Role | null;
  isLoading: boolean;            // me pending OR (orgId set AND org pending)
  isError: boolean;              // org query error (me errors are handled by Shell)
  refetch: () => void;
}
```

Reads `getCurrentOrgId()` and matches it against `me.memberships` (identical logic to `Shell.tsx` lines resolving `activeMembership`). Does NOT call `resolveCurrentOrgId` itself — Shell owns the write; this hook only reads. ≤ 100 lines.

> Refactor note: `Shell.tsx` MAY adopt this hook to de-duplicate, but that's optional and must not change Shell behavior.

### `hooks/use-leave-org.ts` → `useLeaveOrg(orgId)` (NEW)

```ts
useMutation({
  mutationFn: () =>
    apiFetch<void>(`/api/v1/organizations/${orgId}/leave`, { method: 'POST' }),
  // NOT optimistic (spec 02 §3 item 4).
  // Success side-effects live in the component flow (spec 02 §3 — 3a):
  //   setCurrentOrgId(null) → queryClient.invalidateQueries() (full wipe)
  //   → toast → router.push('/dashboard') → router.refresh()
});
```

Full-wipe invalidation, not targeted keys: leaving changes the tenant context, the same class of event as switch-org (multi-tenancy spec 05 §1: "we're effectively a different tenant now").

### `hooks/use-check-slug.ts` → `useCheckSlug(slug)` (NEW)

```ts
function useCheckSlug(rawSlug: string): { status: SlugCheckStatus } {
  const slug = rawSlug.trim();
  const valid = SLUG_PATTERN.test(slug) && slug.length >= 3 && slug.length <= 60;
  const debounced = useDebouncedValue(slug, 400);   // small shared util; settles 400ms after last change
  const query = useQuery({
    queryKey: ['slug-check', debounced],
    enabled: valid && debounced === slug,            // only when the debounce caught up
    staleTime: 30_000,
    retry: false,                                    // advisory — never retry-spam
    queryFn: ({ signal }) =>
      apiFetch<{ data: { slug: string; available: boolean } }>(
        `/api/v1/organizations/check-slug?slug=${encodeURIComponent(debounced)}`,
        { skipOrgHeader: true, signal },
      ),
  });

  // Status derivation:
  // !valid                          → 'idle'
  // valid && (debouncing || query.isPending) → 'checking'
  // query.isError                   → 'idle'   (silent degrade, overview J4)
  // data.available === true         → 'available'
  // data.available === false        → 'taken'
}
```

**422-overwrite rule** (spec 03 §1): when `POST /organizations` fails with `errors.slug` for slug S, the create-org mutation's error handler runs `queryClient.setQueryData(['slug-check', S], { data: { slug: S, available: false } })`. One-line addition to `use-create-org.ts`.

---

## 3. Invalidation rules (additions)

| Action | Invalidate |
|---|---|
| Leave org (POST …/leave 204) | `queryClient.invalidateQueries()` — full wipe + `setCurrentOrgId(null)` + cookie clear + redirect `/dashboard` |
| Leave org error 403/404 | same cleanup as success (membership is gone either way — spec 02 §3 3c) |
| Create org 422 on slug | `setQueryData(['slug-check', slug], …available:false)` |

Dashboard counts need no new invalidation wiring: invite/revoke/remove mutations from previous blocks already invalidate `['invitations', orgId]` and `['organization', orgId, 'members']`, and `refetchOnWindowFocus: 'always'` keeps the tiles honest when the user returns to the tab.

---

## 4. Error normalization

`parseApiError` (existing) handles everything except the new `code` field check:

- Leave 422: read `body.code === 'lone_owner'` → `t.settings.leaveOrg.errors.loneOwner`; fallback precedence per `04-i18n-strings.md` §2. Follow the same pattern `invitations` used for `body.code` mapping (`invitations-ui/06-flows-and-errors.md` §1) — extend, don't fork.
- check-slug errors: swallowed at the hook level (status `'idle'`); never reach `parseApiError`/toasts.

---

## 5. Type contracts (additions to `lib/types/api.ts`)

```ts
export interface SlugCheckResponse {
  data: {
    slug: string;
    available: boolean;
  };
}

export type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'taken';

// POST /organizations/{id}/leave → 204, no body. apiFetch<void>.
```

`Organization.created_at`, `Paginated<T>.meta.total`, `Membership.role` already exist — no changes.

---

## 6. Component ↔ data wiring summary

```
DashboardView (client)
├── useMe()                → greeting name, memberships
├── useCurrentOrg()        → orgId, role, organization (name, created_at)
├── useMembers(orgId,{page:1})  → meta.total   (Members card)
└── useInvitations(orgId)       → meta.total   (Pending card)

LeaveOrgSection (client, settings Geral tab)
├── props: organization, role   (from GeneralTab — already fetched)
└── useLeaveOrg(organization.id)

CreateOrgModal (existing, stateful)
├── useCheckSlug(slug)     → status
└── CreateOrgForm          → renders <SlugAvailability status={…} slug={…} />
```

---

## 7. Testing pointers (for testing-agent)

- `useCheckSlug`: debounce coalesces keystrokes into one request; invalid pattern never fetches; error → `'idle'`; 422-overwrite flips a cached `'available'` to `'taken'`.
- `useLeaveOrg` + `LeaveOrgSection`: 204 path clears org storage, wipes cache, navigates, toasts; 422 `lone_owner` keeps dialog open with `role="alert"` content; 403 runs cleanup-anyway.
- `DashboardView`: role-gated invite action hidden for `member`; per-card error renders retry with contextual `aria-label`; greeting boundary cases (11:59/12:00, null name).
- `SlugAvailability`: renders nothing at `min-h` for `idle`; live region attributes present once (not re-mounted per state — avoid SR re-announcement glitches).

---

## 8. Open judgment calls

- **`useCurrentOrg` reads, never writes** — keeping `resolveCurrentOrgId` writes in Shell avoids two writers racing on localStorage during org switches.
- **`useDebouncedValue` util vs debouncing inside the hook** — extracted util recommended (first reusable debounce in the codebase; search input in MembersToolbar could adopt it later). Inline is acceptable if frontend-agent prefers fewer files.
- **Counts via list endpoints page 1** — accepted payload overhead (≤ 20 rows each) per overview J5. If a product on this starter has 10k-member orgs, swap to a `/stats` endpoint then.
