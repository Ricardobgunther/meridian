# 02 — Leave Organization

Spec status: Feature-level. Closes the TODO from `multi-tenancy-ui/04-org-settings-page.md` §4.4 item 3 ("To leave the org, viewer uses a dedicated 'Sair da organização' action").
Depends on: overview D1 (backend `POST /organizations/{organization}/leave` — **blocker**), J1/J2 (placement and guard doctrine), `04-i18n-strings.md`, `05-state-and-data-flow.md`.

---

## 1. Placement (decision — see overview J1)

A dedicated card on the **Geral tab** of `/org/[slug]/settings`, rendered **between** the "Informações" card and the "Zona de perigo" card:

```
[ Informações ............................. ]   ← existing (GeneralForm/GeneralTab)

┌──────────────────────────────────────────────────────────────────────────┐
│  Sair da organização                                                     │
│  Você perderá o acesso a Acme Brasil. Para voltar, será necessário       │
│  receber um novo convite.                                                │
│                                                                          │
│  ⚠ Donos só podem sair quando houver outro Dono na organização.          │  ← only when your_role === 'owner'
│                                                                          │
│                                                  [ Sair da organização ] │
└──────────────────────────────────────────────────────────────────────────┘

[ Zona de perigo ........................... ]   ← existing (DangerZone, owner-only)
```

Ordering rationale: it reads as escalating severity — edit info → remove yourself → destroy the org. The leave card must NOT live inside `DangerZone.tsx`: that component is rendered only for owners (spec 04 §3), while leaving is available to **all roles**.

Component: `LeaveOrgSection.tsx` in `frontend/app/(authenticated)/org/[slug]/settings/_components/` (sibling of `DangerZone.tsx`, same composition style: section card + `ConfirmDialog`). Mounted from `GeneralTab.tsx` with the `organization` (and viewer `role`) it already has.

### Card anatomy

- Container: `rounded-lg border border-border bg-surface-elevated p-6` — **neutral border**, not `border-danger/40`. Leaving is destructive-for-self but reversible by invitation; reserving the red chrome for org destruction keeps the danger zone's signal strong.
- Title: `text-lg font-semibold text-text-primary` — `t.settings.leaveOrg.title`.
- Body: `text-sm text-text-muted` — `t.settings.leaveOrg.body(orgName)`.
- Owner hint (conditional, `your_role === 'owner'`): `text-sm text-warning` prefixed with the `TriangleAlert` icon (`h-4 w-4`, inline, `aria-hidden`) — `t.settings.leaveOrg.ownerHint`. Static text, no fetch (J2).
- Button: variant **danger** (`Button` primitive), right-aligned desktop, full-width `< sm` (`shrink-0 max-sm:w-full` — same responsive pattern as `DangerZone`). Label `t.settings.leaveOrg.cta`. Always enabled (J2).

Layout mirrors `DangerZone`: `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between` wrapping text-stack + button.

---

## 2. Confirm dialog

Reuses `frontend/components/ui/ConfirmDialog.tsx` as-is (it already supports `variant="danger"`, `loading`, and `children` for the inline alert).

```
┌──────────────────────────────────────────────────────┐
│ Sair de Acme Brasil?                            [×]  │
│ Você perderá o acesso imediatamente. Para voltar,    │
│ será necessário receber um novo convite.             │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ⚠ Você é a única pessoa proprietária. Promova    │ │  ← inline alert, only after 422 lone_owner
│ │   outro membro a Dono antes de sair.             │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│              [ Cancelar ]  [ Sair da organização ]   │  ← confirm = danger
└──────────────────────────────────────────────────────┘
```

| Prop | Value |
|---|---|
| `title` | `t.settings.leaveOrg.confirmTitle(orgName)` — "Sair de {org}?" |
| `description` | `t.settings.leaveOrg.confirmBody` |
| `confirmLabel` | `t.settings.leaveOrg.confirm` ("Sair da organização") |
| `cancelLabel` | `t.settings.leaveOrg.cancel` ("Cancelar") |
| `variant` | `danger` |
| `loading` | `leaveMutation.isPending` |
| `children` | the inline alert region (below) |

No type-the-name friction: that pattern is reserved for org **deletion** (irreversible, affects everyone). Leaving affects one person and is reversible via a new invite — a plain confirm is proportional.

### Inline error alert (dialog `children`)

A slot rendered only when the last submit failed:

- Container: `rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-text-primary`, `role="alert"`.
- Content for `code === 'lone_owner'` (or any 422 from this endpoint): `t.settings.leaveOrg.errors.loneOwner` — *"Você é a única pessoa proprietária desta organização. Promova outro membro a Dono antes de sair."* (Frontend copy wins over the backend's message, which says "owner" — anglicism; the backend PT-BR message is the fallback if `code` is absent and `body.error` exists.)
- Content for other errors: `parseApiError(err).message` (network/5xx/429 already mapped to friendly PT-BR by spec 05 §4 of the multi-tenancy block).
- The dialog **stays open** on error so the user can read and act; clearing: the alert resets when the dialog closes or a new submit starts.
- Why inline, not toast: the lone-owner case requires reading + a next step (promote someone); toasts auto-dismiss in 6s.

---

## 3. Flow

```
1. User clicks [Sair da organização] in the card → dialog opens (local useState,
   same pattern as DangerZone; no uiStore modal kind needed).
2. User confirms → POST /api/v1/organizations/{id}/leave (X-Organization-Id header
   auto-injected by apiFetch; org id from the organization prop).
3a. 204 →
    - close dialog
    - setCurrentOrgId(null)  (localStorage + cookie mirror cleared — lib/org/current.ts)
    - queryClient.invalidateQueries()        ← FULL cache wipe; tenant context changed
      (same doctrine as switch-org, spec 05 §1 invalidation table of the multi-tenancy block)
    - toast.success(t.settings.leaveOrg.successToast,
        { description: t.settings.leaveOrg.successToastBody(orgName) })
    - router.push('/dashboard'); router.refresh()
    - Shell re-resolves: resolveCurrentOrgId picks the next membership automatically,
      or — if this was the user's last org — renders ShellEmpty (welcome state).
    - aria-live (polite) announcement via the existing #shell-live region:
      t.settings.leaveOrg.announcement(orgName)
3b. 422 (lone_owner) → inline alert in dialog (§2); dialog open; button re-enabled.
3c. 403/404 (membership vanished mid-session — e.g. removed by an admin meanwhile) →
    close dialog; toast.error(parseApiError); then run the SAME post-leave cleanup as 3a
    (the user is effectively out either way: clear org, wipe cache, go to /dashboard).
3d. Network / 5xx / 429 → inline alert in dialog with parseApiError message; dialog open.
4. NOT optimistic. Membership removal must be confirmed server-side before the client
   tears down its tenant context (same reasoning as accept-invite, invitations J4).
```

Toast-before-navigation is safe: sonner's toaster is mounted at the root and survives client-side navigation.

---

## 4. States summary

| State | Visual |
|---|---|
| Card default | as §1 |
| Button hover / focus / active | standard danger Button states (Button primitive) |
| Dialog open | focus trapped; initial focus on Cancelar (ConfirmDialog/Dialog default — safe default for destructive dialogs) |
| Submitting | both dialog buttons disabled, confirm `aria-busy="true"` (ConfirmDialog `loading`); confirm label may swap to `t.settings.leaveOrg.leaving` ("Saindo…") for parity with `DangerZone` — optional |
| Error (lone owner) | inline alert, `role="alert"`, dialog open |
| Error (other) | per §3 branches |
| Success | dialog closed, toast, redirect — no in-card success state |

---

## 5. Accessibility

- Dialog inherits the `Dialog` primitive guarantees: focus trap, `Esc` closes, backdrop click closes, focus returns to the trigger button on close.
- `role="alert"` on the inline error → announced assertively without moving focus.
- Success announced politely via the shell live region (the page navigates away; the toast alone is not reliable for SR users mid-navigation).
- The owner hint in the card is plain text (always rendered for owners) — not `aria-live`; it isn't a status change.
- Button is a real `<button>`; never a link styled as one (it mutates state).

---

## 6. Permissions

| Viewer role | Sees card | Can leave |
|---|---|---|
| owner | yes (+ owner hint line) | only if another owner exists — enforced by backend (`LoneOwnerException` → 422 `lone_owner`) |
| admin | yes | yes |
| member | yes | yes |

UI never hides the card by role; the backend is the authority on the lone-owner invariant (defense in depth).

---

## 7. Open judgment calls

- **Settings card vs UserMenu item** — settled in overview J1 (settings). Revisit only if analytics show members can't find it; the cheap future mitigation is *adding* a UserMenu shortcut that deep-links to `/org/[slug]/settings` (navigation, not action).
- **Neutral card chrome vs red danger chrome** — neutral. Red is reserved for org-wide destruction; two adjacent red cards would dilute both.
- **No pre-flight owner count** — accepted trade-off (J2): a lone owner discovers the block only after confirming. The inline alert names the exact remedy, and the card-level `ownerHint` pre-warns every owner.
- **403/404 treated as "already out" (3c)** — alternative is to just show an error. Chose cleanup-anyway because every signal says the membership is gone; leaving stale tenant state would 403 every subsequent request.
