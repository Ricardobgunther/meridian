# 00 — Overview: Dashboard, Leave Org & Slug Preview

Spec status: **Block-level overview**. Successor to `invitations-ui/` — assumes that block (invitations, members page, accept flow) is already shipped on `feature/multi-tenancy-starter`.
Audience: `backend-agent` (two small endpoints), `frontend-agent` (implements), `testing-agent` (covers), `review-agent` (validates).

> All UI in `dashboard-and-leave-org/` consumes tokens from `multi-tenancy-ui/00-design-tokens.md`. **No new tokens. No new visual primitives.** Copy tone unchanged: educated, concise, PT-BR.

---

## 1. Goals

This block closes three declared TODOs from earlier specs and replaces the last placeholder page:

1. **Real dashboard** — replace the placeholder at `frontend/app/(authenticated)/dashboard/page.tsx` with a generic, starter-appropriate overview of the active organization (greeting, four stat cards, quick actions). No business domain — products built on this starter will replace it.
2. **Leave organization** — the dedicated "Sair da organização" action promised as TODO in `multi-tenancy-ui/04-org-settings-page.md` §4.4 item 3.
3. **Live slug availability preview** — the `// TODO: when /api/v1/organizations/check-slug exists` left by `multi-tenancy-ui/03-create-org-modal.md` §8.

## 2. Out of scope (mention as TODO; do not design)

- Charts, activity feeds, audit logs, or any time-series widget on the dashboard.
- Ownership transfer flow ("promote someone then leave" is two existing actions; a guided wizard is future work).
- Slug preview on the settings `GeneralForm` slug field — the component built for item 3 must be reusable so this becomes a 5-minute follow-up, but it is not wired in this block (see `03-slug-availability-preview.md` §7).
- Dashboard personalization (reordering cards, hiding sections).

---

## 3. Surface map

| Surface | Where | Spec file |
|---|---|---|
| Dashboard page | `/dashboard` (replaces placeholder) | `01-dashboard-page.md` |
| Leave-org section + confirm dialog | `/org/[slug]/settings` (Geral tab) | `02-leave-organization.md` |
| Slug availability line | Inside `CreateOrgForm` (create-org modal) | `03-slug-availability-preview.md` |
| New PT-BR strings | `frontend/lib/i18n/dict/pt-BR/` | `04-i18n-strings.md` |
| Query keys, hooks, invalidation | `frontend/hooks/`, `frontend/lib/` | `05-state-and-data-flow.md` |

---

## 4. Backend dependencies (blockers — backend-agent goes first)

The natural order is `backend-agent` → `frontend-agent` (no schema work; `database-agent` not needed).

### D1 — Leave endpoint: `POST /api/v1/organizations/{organization}/leave`

Does not exist today, and the existing `DELETE /organizations/{organization}/members/{member}` **cannot** be reused: `MembershipService::remove()` requires the actor to `canManageMembers()` and to outrank the target — a plain `member` can never self-remove, and an `admin` cannot remove a same-rank target (themselves). Relaxing those invariants for the self-case would weaken a guard that exists for good reason; an explicit `leave()` use case is safer and self-documenting.

Contract:

| Aspect | Value |
|---|---|
| Route | `POST /api/v1/organizations/{organization}/leave` — inside the `org.resolve` group, same as members routes |
| Auth | `supabase.auth`; actor must hold an active membership (guaranteed by `org.resolve`) |
| Behavior | Soft-deletes the **caller's own** membership via a new `MembershipService::leave(Organization, User)` that reuses `guardLastOwner()` |
| Success | `204 No Content` |
| Lone owner | `422` with `{ "error": <PT-BR message>, "code": "lone_owner" }` — reuse `LoneOwnerException` (already rendered to 422 PT-BR by the handler); add the `code` field so the frontend doesn't string-match |
| Not a member / cross-tenant | `403`/`404` via existing `org.resolve` behavior |

Verb route (`/leave`) over `DELETE /members/me`: matches the existing precedent `POST /invitations/{id}/resend`, and avoids special-casing the `{member}` route binding with a magic `me` literal.

### D2 — Slug check endpoint: `GET /api/v1/organizations/check-slug`

| Aspect | Value |
|---|---|
| Route | `GET /api/v1/organizations/check-slug?slug={slug}` — sibling of `GET /organizations` (NOT inside `org.resolve`; no tenant context needed) |
| Auth | `supabase.auth` required (do not expose slug enumeration to anonymous traffic); standard `throttle:60,1` is enough — slugs are public in URLs anyway, low sensitivity |
| Validation | `slug` required, must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–60 chars → otherwise `422` (standard Laravel shape) |
| Success | `200` `{ "data": { "slug": "acme-brasil", "available": true } }` |
| Semantics | `available = false` when an organization (including soft-deleted, mirroring whatever uniqueness rule the `POST /organizations` validation applies) holds the slug. **Must match POST's uniqueness rule exactly** — the preview lies otherwise. |
| Caching | Response must be accurate but is advisory only; no cache headers needed beyond default `no-store` posture for API |

> Route registration note: `check-slug` must be declared **before** `GET /organizations/{organization}` is even a non-issue here (different path segment count), but backend-agent should confirm no binding collision with the `{organization}` wildcard.

---

## 5. Cross-cutting judgment calls (resolved here, not re-litigated downstream)

### J1 — Where "Sair da organização" lives: **Settings page (Geral tab), not the UserMenu**

Examined both candidates (`UserMenu.tsx` and the settings page next to `DangerZone.tsx`). **Pick: a dedicated card on the Geral tab of `/org/[slug]/settings`, between "Informações" and "Zona de perigo".**

Rationale:
1. **Scope match.** The UserMenu is account-scoped (Minha conta, Tema, Sair). Adding "Sair da organização" one item above "Sair" (logout) puts two near-identical destructive labels in the same 200px menu — a classic mis-click trap, and screen-reader users hear "Sair da organização… Sair" with no surface context.
2. **Established home for membership lifecycle.** Members, invites, roles and org deletion already live in Settings. Leaving is the self-directed end of that same lifecycle. GitHub, Slack and Linear all place "Leave organization/workspace" in the org's settings surface, not in the avatar menu.
3. **Explicit org context.** The settings URL carries the slug; the dialog can name the org unambiguously. The UserMenu renders even when the user is mid-switch between orgs.

Trade-off accepted: slightly lower discoverability for plain members. Mitigated because members can already open the settings page (readonly view per spec 04 §3) and the leave card is visible to **all roles** — it is the one mutating action a plain member owns there.

### J2 — Lone-owner guard: **client hints, server decides**

The client does not reliably know the org's owner count without an extra members fetch. Decision: the leave button is **always enabled**; the confirm dialog submits and maps a `422 lone_owner` response to an inline alert inside the dialog (not a toast — the user needs to read it and act). When `your_role === 'owner'`, the card additionally shows a static helper line warning that another owner must exist. No pre-flight fetch. Backend is the authority (defense in depth, same doctrine as spec 04 §6).

### J3 — Dashboard quick action "Convidar membro": **navigate to the members page, do not open `InviteModal` cross-page**

`InviteModal` is colocated with the members page and fed by `MembersTab` context (`orgId`, role gating, list invalidation). Mounting it on the dashboard would either duplicate the modal or force it into the global `uiStore.activeModal` union for one shortcut. Navigation to `/org/[slug]/settings/members` is one click more but keeps one owner for the invite flow. TODO noted for a future global command palette.

### J4 — Slug check is advisory, never authoritative

- Check **failure** (network, 5xx, 429): render nothing, keep helper text, do not block submit, do not announce. The user must never be punished because an advisory endpoint hiccuped.
- Check says **indisponível**: show danger feedback but **do not disable submit**. The `422` from `POST /organizations` remains the single source of truth (the check result can be stale). This means the worst case is identical to today's behavior.
- Check says **disponível**: success feedback; still no guarantee (race with another creator) — the POST 422 path from spec 03 §4 stays untouched.

### J5 — Stat counts come from existing list endpoints, no new aggregate endpoint

`GET /organizations/{id}/members` and `GET /invitations` both return `meta.total`. Reusing them (page 1) costs one row-page of payload but zero backend work and keeps cache keys shared with the pages users navigate to next. A dedicated `/stats` endpoint is a future optimization, not v1.

---

## 6. Accessibility budget (carries forward)

- WCAG 2.1 AA, no regressions. All interactive elements keyboard-operable with the standard focus-ring recipe (tokens spec §8).
- Dashboard: one `<h1>` (greeting), `<h2>` per section; stat values readable by SR with full context (label + value in one accessible name).
- Leave dialog: existing `ConfirmDialog`/`Dialog` primitives (focus trap, `Esc`, focus return). Inline 422 alert uses `role="alert"`.
- Slug status line: `aria-live="polite"`, `aria-atomic="true"`; color is never the only signal (icon + text always).
- All entrance animations respect `prefers-reduced-motion` (`motion-reduce:animate-none`, same as `UserMenu`).

---

## 7. Risks to surface before implementation starts

1. **D1/D2 are blockers** — frontend work on items 2 and 3 cannot ship without the endpoints. Item 1 (dashboard) has zero backend dependency and can start immediately.
2. **`available` semantics vs soft-deleted orgs (D2)** — must mirror the POST validation rule, whatever it is. Backend-agent confirms with a test that check-slug and POST agree.
3. **Leaving your only org** drops the user into `ShellEmpty` (welcome/empty state). This is intentional and already built — but confirm the product is happy with that landing.

---

## 8. Spec file index

| File | Topic |
|---|---|
| `00-overview.md` | This file. Goals, backend contracts, judgment calls. |
| `01-dashboard-page.md` | Dashboard layout, cards, quick actions, all states. |
| `02-leave-organization.md` | Leave card, confirm dialog, error mapping, post-leave flow. |
| `03-slug-availability-preview.md` | Debounced check UX inside `CreateOrgForm`. |
| `04-i18n-strings.md` | Every new PT-BR string (`dashboard.*`, `settings.leaveOrg.*`, `orgs.create.slugCheck.*`). |
| `05-state-and-data-flow.md` | Query keys, hooks, invalidation, type contracts. |
