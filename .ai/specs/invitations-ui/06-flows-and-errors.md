# 06 — Flows & Errors (Part 2 of data-flow spec)

Spec status: Companion to `05-state-and-data-flow.md`. Contains the full error mapping table, end-to-end flow examples, and TypeScript type contracts.

Depends on: spec 05 (this file references hooks defined there).

---

## 1. Error mapping — full table

The frontend reads `body.code` from API errors first; falls back to status code. `parseApiError` (from `multi-tenancy-ui/05` §4) is extended with the entries below — frontend-agent updates `lib/api/errors.ts` accordingly.

| Backend response | Surfacing |
|---|---|
| 201 (created) | Toast: `t.invitations.modal.sentToastTitle` / `sentToastBody(email)` |
| 204 (deleted / revoked) | Toast: `t.invitations.list.revokedToast` / `revokedToastBody(email)` |
| 200 on resend | Toast: `t.invitations.list.resentToast` / `resentToastBody(email)` |
| 200 on accept | Redirect to `/org/{slug}`; announce |
| 400 generic | Toast: parseApiError defaults |
| 401 | Auto-redirect to `/login` (existing `apiFetch` behavior). For accept-page POST, append `?invite={token}` to the login URL. |
| 403 on POST /invitations (member tried) | Toast: `t.invitations.modal.errors.forbidden`; close modal |
| 403 on DELETE/resend | Toast: same `forbidden` copy |
| 404 on POST accept (token vanished) | Swap accept page to Invalid card (spec 03 §3.5) |
| 409 `code: invitation_already_member` | Inline field error on email input |
| 409 `code: invitation_already_pending` | Inline field error on email input |
| 410 on POST accept (used between preview and POST) | Swap accept page to Expired card; show inline banner above buttons "Este convite já foi usado." |
| 422 on POST /invitations | Map `fieldErrors` to inputs (email → `emailLabel`, role → `roleLabel`) |
| 422 `code: invitation_email_mismatch` on POST accept | Swap to Wrong-email guard card |
| 429 on POST /invitations | Toast: `t.invitations.modal.errors.rateLimitedTitle` / `rateLimitedBody` |
| 429 on POST resend | Toast: `t.invitations.list.resendRateLimitedTitle` / `resendRateLimitedBody` |
| 5xx | Toast: parseApiError 5xx defaults; keep modal/card open |
| Network failure | Toast: parseApiError network defaults |

### Extending `parseApiError`

The existing helper returns `{ title, message, fieldErrors? }`. Add a `code` pass-through:

```ts
type ParsedError = {
  title: string;
  message: string;
  code?: string;                 // pass-through of body.code if present
  fieldErrors?: Record<string, string>;
};
```

Consumers check `parsed.code` first (e.g. `if (parsed.code === 'invitation_already_member')`) and fall back to status-based handling. Backwards-compatible.

---

## 2. End-to-end flow examples

### Example A: Owner invites Bruno

```
1. Owner on /org/acme/settings/members. "Convidar membro" button visible.
2. Click → uiStore.openModal({ kind: 'invite-member' }).
3. Modal mounts (spec 02), focuses email input.
4. Owner types "bruno@acme.com", picks "Administrador", clicks "Enviar convite".
5. useCreateInvitation().mutate({ email, role }):
   a. apiFetch POST /api/v1/invitations
   b. 201 + { data: invitation }
   c. toast.success("Convite enviado", { description: "Enviamos um link para bruno@acme.com." })
   d. announce("Convite enviado para bruno@acme.com")
   e. invalidate ['invitations', orgId]
   f. uiStore.closeModal()
6. Pending list refetches; new row appears.
```

### Example B: Bruno opens email link (no account)

```
1. Bruno clicks email link → GET /invite/{token}
2. Server Component fetches preview server-side:
   GET /api/v1/invitations/accept/{token} → { status: 'valid', data: {...} }
3. Server reads cookies via @supabase/ssr → no session.
4. Renders AcceptReadyAnonCard with email "bruno@acme.com".
5. Bruno clicks "Entrar ou criar conta" → /login?invite={token}
6. Bruno signs up via Supabase, email is confirmed.
7. Auth callback redirects → /invite/{token} (because of invite param).
8. Page re-fetches preview server-side → { status: 'valid' }.
9. Session now exists with email matching → renders AcceptReadyAuthedCard.
10. Bruno clicks "Aceitar".
11. useAcceptInvitation().mutate():
    a. POST /api/v1/invitations/accept/{token} (skipOrgHeader)
    b. 200 + { data: { organization: { id, slug, name } } }
    c. announce("Convite aceito. Bem-vindo(a) a Acme Brasil.")
    d. queryClient.invalidateQueries()           // full wipe
    e. setCurrentOrgId(newOrgId)
    f. router.push(`/org/${slug}`)
12. Bruno lands on the org home.
```

### Example C: Race — token consumed between preview and POST

```
1. Bruno opens /invite/{token} → preview returns 'valid'.
2. Some background tab races and consumes the same token (or admin revokes it).
3. Bruno clicks "Aceitar".
4. POST returns 410 Gone with code 'invitation_expired' or 'invitation_revoked'.
5. useAcceptInvitation onError detects the code → swap card to Expired/Revoked.
6. Banner inside the new card: "Este convite já foi usado." (additional context).
```

### Example D: Owner revokes Bruno's invite

```
1. Owner clicks ··· on Bruno's pending row → "Revogar convite".
2. Confirm dialog opens.
3. Owner clicks "Revogar".
4. useRevokeInvitation().mutate():
   a. onMutate: snapshot current cache, optimistically remove the row.
   b. DELETE /api/v1/invitations/{id}
   c. 204 → toast.success("Convite revogado") + announce.
   d. onSettled: invalidate ['invitations', orgId] (refetch confirms).
5. If DELETE 403's (race — owner lost permission): rollback snapshot,
   dialog stays open with inline error banner.
```

### Example E: Wrong-email guard

```
1. Bruno is logged in as bruno-pessoal@gmail.com.
2. He clicks the email link → /invite/{token}.
3. Server fetches preview → { status: 'valid', data: { email: 'bruno@acme.com', ... } }.
4. Server reads session → email is bruno-pessoal@gmail.com → mismatch.
5. Renders WrongEmailCard with both emails.
6. Bruno clicks "Sair desta conta" → SignOutButton calls supabase.auth.signOut(),
   then router.push(`/login?invite={token}`).
7. Bruno logs in as bruno@acme.com → callback redirects to /invite/{token}.
8. Now preview + session match → AcceptReadyAuthedCard.
```

---

## 3. Type contracts (additions to `lib/types/api.ts`)

```ts
export interface Invitation {
  id: string;
  email: string;
  role: 'member' | 'admin';
  invited_by: {
    id: string;
    name: string | null;
    email: string;
    is_active_member: boolean;
  };
  expires_at: string;
  created_at: string;
  resent_at: string | null;
}

export interface InvitationsListResponse {
  data: Invitation[];
  meta?: ApiListMeta;
}

export interface AcceptPreviewValid {
  status: 'valid';
  data: {
    organization: { id: string; slug: string; name: string };
    role: 'member' | 'admin';
    email: string;
    inviter: { name: string | null };
    expires_at: string;
  };
}

export type AcceptPreviewResponse =
  | AcceptPreviewValid
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'not_found' };

export interface AcceptResponse {
  data: {
    organization: { id: string; slug: string; name: string };
    role: 'member' | 'admin';
  };
}
```

---

## 4. Cross-invalidation map

When the **accept** mutation succeeds (the most cross-cutting action):

```
1. queryClient.invalidateQueries()         // wipe entire cache — new tenant
2. setCurrentOrgId(newOrgId)               // localStorage + cookie
3. router.push(`/org/${newOrgSlug}`)       // navigate to the new home
```

The full wipe is intentional: any data the user had cached belongs to a previous tenant context. Same pattern as switching orgs (`multi-tenancy-ui/05` §1 invalidation table).

When **create / revoke / resend** succeed (inviter side):

```
1. queryClient.invalidateQueries({ queryKey: ['invitations', orgId] })
```

The members list (`['organization', orgId, 'members']`) is NOT invalidated by these actions — invites don't materialize as members until accepted. The accepting user's session wipes its own cache on accept; OTHER active sessions in the same org don't auto-update (out of scope; would need a realtime channel).

---

## 5. Open judgment calls

- **`skipOrgHeader` on accept endpoints**: necessary because the user may have no active org context yet (first org join). Without it, `apiFetch` would attach a stale header from localStorage and confuse the backend.
- **Whether to invalidate `['organization', orgId, 'members']` after accept**: the spec doesn't because the accepting user has just become a member of a different org; their own member row appears via the natural list refetch in the new org's settings. Realtime "X just joined" updates for OTHER active sessions is a future realtime channel concern, not a query invalidation one.
- **Full cache wipe on accept**: aggressive but correct. A future optimization could be a targeted invalidation list, but the wipe matches the existing org-switch behavior and keeps tenant boundaries clean.
- **Resend not optimistic**: chose to keep it simple. Could be optimistic by faking a new `expires_at` (now + 7 days) and rolling back on error; rejected because the row visually shifts color/category (urgent → calm) and a rollback is jarring.
- **`useInvitationPreview` rarely used**: included for completeness. Server Component preview is the primary path; if the frontend-agent finds the client hook unused after implementation, removing it is fine.
- **Token in URL exposed to localStorage / cookies**: NO. The token lives only in `params.token` server-side and in the AcceptForm closure client-side. Never persisted, never logged.
- **Decline endpoint shape**: spec assumes a separate `POST .../decline`. Backend-agent may prefer combining accept/decline into one endpoint with `body.action`. Frontend-agent updates the two hooks accordingly; the rest of the spec is unchanged.
- **`body.code` contract**: backend-agent commits to returning the codes listed in `04-i18n-strings.md` §5. If backend can't comply on day one, frontend falls back to status-code-based mapping and the inline-error logic in the invite modal degrades gracefully (server message wins, but code-specific UX like "swap to Expired card" won't fire). Worth confirming early.
