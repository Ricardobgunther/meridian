# 05 — State & Data Flow (Part 1: Endpoints, Keys, Hooks)

Spec status: Architecture for the client-side data layer of the invitations block.
Depends on: `multi-tenancy-ui/05-state-and-data-flow.md` (existing TanStack Query / Zustand setup, `apiFetch`, `parseApiError`).

Continued in `06-flows-and-errors.md` (error mapping table, end-to-end flow examples, type contracts).

> This spec ADDS new query keys, hooks, mutations, and store state. It does not replace the existing data layer.

---

## 1. Endpoints consumed

All routes under `/api/v1/`. Backend-agent owns the exact request/response contracts; this spec mirrors the shape the UI assumes.

| # | Method + Path | Purpose | Auth | Org header |
|---|---|---|---|---|
| 1 | `GET /api/v1/invitations` | List pending invitations for the active organization | Required | Required |
| 2 | `POST /api/v1/invitations` | Create a new invitation (sends email) | Required | Required |
| 3 | `DELETE /api/v1/invitations/{id}` | Revoke a pending invitation | Required | Required |
| 4 | `POST /api/v1/invitations/{id}/resend` | Resend the invitation email (regenerates token, resets expiry) | Required | Required |
| 5 | `GET /api/v1/invitations/accept/{token}` | Preview: check status + return invite details, does NOT consume | Optional (public allowed) | Not required |
| 6 | `POST /api/v1/invitations/accept/{token}` | Accept the invitation (consumes token, creates membership) | Required | Not required (org derived from token) |
| 7 | `POST /api/v1/invitations/accept/{token}/decline` | Decline (token is consumed, no membership created) | Required | Not required |

> Endpoints 5–7 are intentionally outside the `X-Organization-Id` scope. The token IS the org scope. `apiFetch` calls these with `skipOrgHeader: true`.

### Response shapes (assumed)

```ts
// GET /api/v1/invitations
interface InvitationsListResponse {
  data: Invitation[];
  meta?: ApiListMeta;  // present if backend paginates; v1 expects single page
}

interface Invitation {
  id: string;
  email: string;
  role: 'member' | 'admin';            // never 'owner'
  invited_by: {
    id: string;
    name: string | null;
    email: string;
    is_active_member: boolean;          // false if inviter has been removed
  };
  expires_at: string;                   // ISO 8601
  created_at: string;
  resent_at: string | null;
}

// POST /api/v1/invitations  body: { email, role } → 201 + { data: Invitation }
// DELETE /api/v1/invitations/{id} → 204
// POST /api/v1/invitations/{id}/resend → 200 + { data: Invitation } (with new expires_at)
```

```ts
// GET /api/v1/invitations/accept/{token}
type AcceptPreviewResponse =
  | { status: 'valid'; data: { organization: {...}; role; email; inviter; expires_at } }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'not_found' };
```

Full shapes live in `06-flows-and-errors.md` §3 (type contracts).

---

## 2. TanStack Query — query keys

| Key | Endpoint | staleTime | gcTime | Notes |
|---|---|---|---|---|
| `['invitations', orgId]` | #1 | `30_000` (30s) | `5 * 60_000` | Refetched on focus and after any invitations mutation. |
| `['invitation-preview', token]` | #5 | `0` (always fresh) | `60_000` | Public; called from `/invite/[token]` Server Component. Client cache only matters if the user re-enters via client navigation, which is rare. |

> No paginated key variant for v1 since `meta` is not used. When pagination is added, switch to `['invitations', orgId, { page }]` matching the members list pattern.

### Defaults

Already set globally in `multi-tenancy-ui/05` §1. No changes here. Mutations stay `retry: false`.

### Invalidation rules (additions to the existing table)

| Action | Invalidate |
|---|---|
| Create invitation (POST #2 → 201) | `['invitations', orgId]` |
| Revoke invitation (DELETE #3 → 204) | `['invitations', orgId]` |
| Resend invitation (POST #4 → 200) | `['invitations', orgId]` |
| Accept invitation (POST #6 → 200) | Full cache wipe (`queryClient.invalidateQueries()`) — new tenant context. |
| Decline invitation (POST #7 → 200) | `['invitation-preview', token]` AND `['invitations', orgId]` for the inviter side (next focus refetch picks it up). |

The accept-side does NOT need to know its own previous `orgId`. After redirect the new org becomes active and the cache is wiped per the existing "switch active org" rule.

---

## 3. Hooks (file naming `hooks/use-*.ts`)

Each ≤ 100 lines per project convention.

```
hooks/
  use-invitations.ts                 → useInvitations(orgId)
  use-invitation-preview.ts          → useInvitationPreview(token)  // client-only
  use-create-invitation.ts           → useCreateInvitation()
  use-revoke-invitation.ts           → useRevokeInvitation(invitationId)
  use-resend-invitation.ts           → useResendInvitation(invitationId)
  use-accept-invitation.ts           → useAcceptInvitation(token)
  use-decline-invitation.ts          → useDeclineInvitation(token)
```

### 3.1 `useInvitations(orgId)`

```ts
return useQuery({
  queryKey: ['invitations', orgId],
  queryFn: ({ signal }) =>
    apiFetch<InvitationsListResponse>('/api/v1/invitations', { signal }),
  enabled: !!orgId,
  staleTime: 30_000,
});
```

### 3.2 `useCreateInvitation()`

```ts
return useMutation({
  mutationFn: ({ email, role }) =>
    apiFetch<{ data: Invitation }>('/api/v1/invitations', {
      method: 'POST',
      json: { email, role },
    }),
  onSuccess: (_resp, vars) => {
    toast.success(t.invitations.modal.sentToastTitle, {
      description: t.invitations.modal.sentToastBody(vars.email),
    });
    announce(t.invitations.modal.sentAnnouncement(vars.email));
    queryClient.invalidateQueries({ queryKey: ['invitations', orgId] });
  },
  // onError: handled by the modal (field-level mapping). See spec 06 §1.
});
```

> The modal owns inline-error logic — `onError` here only handles toast-level fallbacks. The modal calls `mutate(..., { onError })` with its own handler to set field errors.

### 3.3 `useRevokeInvitation(invitationId)` — OPTIMISTIC

```ts
return useMutation({
  mutationFn: () =>
    apiFetch<void>(`/api/v1/invitations/${invitationId}`, { method: 'DELETE' }),
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey: ['invitations', orgId] });
    const snapshot = queryClient.getQueryData<InvitationsListResponse>(['invitations', orgId]);
    queryClient.setQueryData<InvitationsListResponse>(
      ['invitations', orgId],
      (old) => old && { ...old, data: old.data.filter((i) => i.id !== invitationId) },
    );
    return { snapshot };
  },
  onError: (_e, _v, ctx) => {
    if (ctx?.snapshot) queryClient.setQueryData(['invitations', orgId], ctx.snapshot);
    toast.error(t.invitations.list.revokeError);
  },
  onSuccess: () => {
    // Email comes from the row component closure; passed as a second arg via mutate's onSuccess.
    // toast.success + announce — see component-level handler.
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['invitations', orgId] });
  },
});
```

### 3.4 `useResendInvitation(invitationId)` — NOT optimistic

```ts
return useMutation({
  mutationFn: () =>
    apiFetch<{ data: Invitation }>(`/api/v1/invitations/${invitationId}/resend`, {
      method: 'POST',
    }),
  onSuccess: (resp) => {
    const email = resp.data.email;
    toast.success(t.invitations.list.resentToast, {
      description: t.invitations.list.resentToastBody(email),
    });
    announce(t.invitations.list.resentAnnouncement(email));
    queryClient.invalidateQueries({ queryKey: ['invitations', orgId] });
  },
  onError: (err) => {
    if ((err as ApiError).status === 429) {
      toast.error(t.invitations.list.resendRateLimitedTitle, {
        description: t.invitations.list.resendRateLimitedBody,
      });
      return;
    }
    toast.error(t.invitations.list.resendError, { description: parseApiError(err).message });
  },
});
```

### 3.5 `useAcceptInvitation(token)` — NOT optimistic

```ts
return useMutation({
  mutationFn: () =>
    apiFetch<AcceptResponse>(`/api/v1/invitations/accept/${token}`, {
      method: 'POST',
      skipOrgHeader: true,
    }),
  onSuccess: (resp) => {
    const { id, slug, name } = resp.data.organization;
    announce(t.invitations.accept.acceptSuccessAnnouncement(name));
    queryClient.invalidateQueries();  // full wipe — tenant context changed
    setCurrentOrgId(id);
    router.push(`/org/${slug}`);
  },
  // onError: page swaps card on 410 / 422 — see spec 06 §1.
});
```

### 3.6 `useDeclineInvitation(token)` — NOT optimistic

```ts
return useMutation({
  mutationFn: () =>
    apiFetch<void>(`/api/v1/invitations/accept/${token}/decline`, {
      method: 'POST',
      skipOrgHeader: true,
    }),
  onSuccess: () => {
    announce(t.invitations.accept.declineSuccessAnnouncement);
    router.push('/');
  },
});
```

### 3.7 `useInvitationPreview(token)` — client-only

Used in the rare case the accept page is re-rendered client-side (e.g. after auth state change). Default rendering is server-side and goes direct to `apiFetchServer`.

```ts
return useQuery({
  queryKey: ['invitation-preview', token],
  queryFn: ({ signal }) =>
    apiFetch<AcceptPreviewResponse>(`/api/v1/invitations/accept/${token}`, {
      signal,
      skipOrgHeader: true,
      redirectOnAuthError: false,
    }),
  staleTime: 0,
  enabled: !!token,
});
```

`redirectOnAuthError: false` because the preview is intentionally public — a 401 means "we couldn't authenticate you" (still valid, render the anonymous card), not "redirect to login".

---

## 4. Optimistic update boundaries (recap)

| Action | Optimistic? | Why |
|---|---|---|
| Create invitation | No | Server-side validation (duplicate email, rate limit) is meaningful; can't fake the new row's `id` and `expires_at` cleanly. |
| Revoke | Yes | Removing a row is reversible (re-create on error). Low risk. |
| Resend | No | Visible state change is the `expires_at` reset; faking it then rolling back feels worse than a brief spinner. |
| Accept | No | A wrong optimistic redirect lands on an org you can't access. Bad UX. |
| Decline | No | Same. Plus declines are rare. |

---

## 5. Zustand UI store — additions

Add `invite-member` and `confirm-revoke-invitation` to the `activeModal` union and a single optional persisted preference:

```ts
activeModal:
  | null
  | { kind: 'create-org' }
  | { kind: 'confirm-delete-org'; orgId: string }
  | { kind: 'confirm-remove-member'; memberId: string }
  | { kind: 'confirm-role-promote-owner'; memberId: string; targetName: string }
  | { kind: 'confirm-slug-change'; oldSlug: string; newSlug: string }
  | { kind: 'invite-member' }                                          // ← NEW
  | { kind: 'confirm-revoke-invitation';                                // ← NEW
      invitationId: string;
      invitationEmail: string };

// One new persisted preference (allowlist update):
invitationsSectionCollapsed: boolean | null;   // null = use spec default (5-row threshold)
setInvitationsSectionCollapsed: (v: boolean | null) => void;
```

The persist allowlist becomes `sidebarCollapsed`, `theme`, `invitationsSectionCollapsed`.

---

## 6. Continued in spec 06

The full error-mapping table, the end-to-end flow examples (A–E covering invite, accept-no-account, accept-race, revoke, wrong-email guard), and the complete TypeScript type contracts live in `06-flows-and-errors.md`. Frontend-agent should read both files as a pair before implementing.
