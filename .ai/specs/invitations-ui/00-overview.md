# 00 — Overview: Email Invitations

Spec status: **Block-level overview**. Successor to `multi-tenancy-ui/` — assumes that block (organizations, memberships, settings page with Members tab) is already shipped.
Audience: `frontend-agent` (implements), `testing-agent` (covers), `review-agent` (validates).

Branch: `feature/multi-tenancy-starter`. Previous block landed in commit `a27358b`.

> All UI in `invitations-ui/` consumes tokens from `multi-tenancy-ui/00-design-tokens.md`. No new tokens. No new copy tone — educated, concise, PT-BR.

---

## 1. Goals

- Allow `owner` and `admin` to invite people by email to the active organization with a role of `member` or `admin`.
- Track each invitation's lifecycle (pending → accepted | revoked | expired) inside the existing Settings → Members surface.
- Let an invitee click a link in the email, land on `/invite/[token]`, and join the org — even if they don't have an account yet (signup-then-accept flow).
- Make every invitation-related interaction obvious, reversible (when possible), and accessible.
- Reuse the existing design system and copy patterns — no new tokens, no new visual primitives.

## 2. Out of scope (mention as TODO; do not design)

- Bulk invite (paste a list of emails, CSV import).
- Public/shareable link that anyone with the URL can use to join (no targeted email).
- Custom personal message attached to the invite ("Hey João, …").
- Invitation analytics (open rate, click-through, reminder cadence).
- Re-inviting an already-removed member with audit trail / cool-down logic.
- SCIM / Directory sync.
- Locale switching on the public accept page (PT-BR only for now).

These belong in a future `invitations-v2-ui/` spec pack.

## 3. User stories

### Owner invites a new admin

> *As an owner of Acme Brasil, I want to invite Bruno as an admin so he can manage members while I'm on vacation.*

Flow:
1. Owner opens Settings → Members tab.
2. Clicks "Convidar membro" in the header.
3. Invite modal opens. Types `bruno@acme.com`, picks role "Administrador", submits.
4. Toast: "Convite enviado para bruno@acme.com". Modal closes. Pending Invitations list refreshes — Bruno's pending row appears.
5. Bruno receives an email (Mailpit in dev, SMTP in prod). The starter does not own the email template visually — backend-agent handles that.

### Admin invites a new member

Identical to above, with two extra UI rules enforced:
- Role select shows only "Membro" and "Administrador". "Dono" is never offered.
- Otherwise indistinguishable from the owner flow.

### Member views the Members tab

- The header's "Convidar membro" button is **not rendered** (not "disabled" — fully hidden).
- The "Convites pendentes" section is still visible (members can see who else is on the way in), but the per-row Reenviar / Revogar actions are not rendered. (Judgment call — see §5.)

### Invitee with no account accepts

> *As Bruno, I receive an email, click the link, sign up, and end up inside Acme Brasil as an admin.*

Flow:
1. Bruno clicks the email link → browser navigates to `/invite/[token]`.
2. Page is a Server Component that calls `GET /api/v1/invitations/accept/{token}` (a *preview* endpoint — does not consume the token).
3. Server detects no authenticated session.
4. Card renders: "Você foi convidado a entrar em **Acme Brasil**. Faça login ou crie uma conta com **bruno@acme.com** para aceitar."
5. Bruno clicks "Entrar / criar conta" → `/login?invite={token}`.
6. After signup/login, the auth callback notices the `?invite=` param and redirects back to `/invite/{token}`.
7. Now authenticated, the page shows the "Aceitar / Recusar" card.
8. Aceitar → POST `/api/v1/invitations/accept/{token}` → membership created → redirect to `/org/acme-brasil`.

### Invitee with existing account accepts

Same as above, but step 3 sees a valid session whose email matches the invite. Card shows "Aceitar / Recusar" immediately. No detour through `/login`.

### Invite expired

Bruno took too long. He clicks the link 8 days later.
- Page shows: "Este convite expirou. Peça um novo ao administrador."
- A small `<a>` to the marketing/login page exists so he isn't stranded.

### Invite revoked

Owner changed her mind and revoked the invite (see next story) before Bruno clicked.
- Page shows: "Este convite foi revogado."

### Owner revokes a pending invite

> *Owner accidentally invited the wrong email. Wants to undo.*

Flow:
1. Owner opens Settings → Members → finds the pending row.
2. Clicks `···` → "Revogar convite".
3. Confirmation dialog: "Revogar convite para X?" — destructive variant.
4. Confirm → DELETE → optimistic remove → toast "Convite revogado".

### Owner resends a pending invite

> *The invite is about to expire and the invitee hasn't clicked.*

Flow:
1. Owner opens Settings → Members → finds the pending row.
2. Clicks `···` → "Reenviar convite".
3. No confirm dialog — this is non-destructive (it merely re-sends an email; backend regenerates the token internally and resets the 7-day clock).
4. Toast: "Convite reenviado para X". List refreshes (expires-in column resets to "em 7 dias").

### Wrong-email guard

> *Bruno is logged in as `bruno-pessoal@gmail.com` (his personal account) but the invite was sent to `bruno@acme.com`.*

- Card on `/invite/{token}`: "Este convite foi enviado para outro email. Saia desta conta e entre como bruno@acme.com para aceitar."
- A "Sair da conta" button is offered so he doesn't have to navigate manually.

---

## 4. Surface map

| Surface | Where | Spec file |
|---|---|---|
| Pending Invitations section inside Members tab | `/org/[slug]/settings/members` (extends spec `04-org-settings-page.md` §4) | `01-members-page-extension.md` |
| Invite modal | Triggered from the Members tab header button | `02-invite-modal.md` |
| Public accept page | `/invite/[token]` (no shell — minimal layout) | `03-accept-invite-page.md` |
| Email template | Backend's domain — frontend has no visual responsibility | — (out of frontend scope) |

---

## 5. Cross-cutting judgment calls (resolved here, not re-litigated downstream)

These are decisions that affect multiple specs; pinning them at the overview level so the deeper specs don't drift.

### J1 — Section vs sub-tab for "Convites pendentes"

**Pick: contiguous section below the members list, NOT a sub-tab.**

Rationale: Two reasons.
1. **Cognitive proximity.** "Who is on the team?" and "who is on the way to the team?" answer the same mental question. Splitting them into tabs adds a click and hides one half of the answer.
2. **Empty state asymmetry.** Pending is usually 0–3 rows. A whole tab dedicated to a near-empty list feels wasteful. A small section that collapses to a one-line empty state ("Nenhum convite pendente.") is lighter.

Counter-argument considered: with 50+ pending invites in a fast-growing org, the section could overwhelm the members list. Mitigation: pending section has its own collapse toggle (default expanded if `count <= 5`, collapsed otherwise) and shows the count in its header. See spec `01-members-page-extension.md` §2.

### J2 — Member visibility of pending invitations

**Pick: members can SEE the pending list, but cannot Reenviar / Revogar.**

Rationale: transparency is the SaaS-friendly default. Hiding pending invites from members creates a class of "who is being onboarded?" surprises. The action buttons are role-gated regardless; reading is harmless.

Counter-argument considered: some products treat pending invites as confidential. Defensible. Frontend-agent should make the read visibility a single feature flag (`config.invitations.membersCanReadPending = true`) so future products on this starter can flip it without a redesign.

### J3 — Role select: radio vs dropdown

**Pick: segmented radio group (visual), backed by Radix RadioGroup primitive.**

Rationale: only 2 options. A dropdown forces a click to discover both. A segmented radio shows them inline with a one-line description per option. See `02-invite-modal.md` §3.

### J4 — Optimistic update boundaries

- **Revoke** is optimistic (remove row immediately, restore on error). Low risk: re-creating the invitation is one click.
- **Resend** is NOT optimistic. Show a per-row inline spinner on the action menu trigger until the request resolves. Resending shows a "+7d" expiry shift only on success.
- **Accept** (on `/invite/[token]`) is NOT optimistic. Show button-level loading, then navigate on success. Optimistic accept would risk landing on an org page that 403's because the membership was rejected server-side.

### J5 — Wrong-email guard placement

Server-side. The Server Component at `/invite/[token]` reads the session via `@supabase/ssr` and compares to the invite's email (returned by the preview endpoint). If mismatch, render the guard card. Doing this client-side leaks invite metadata before the guard runs.

### J6 — Preserving the token across login

The CTA on the unauthenticated card links to `/login?invite={token}`. The login page is not modified by this spec — but it must, after successful auth, look for `?invite=` and redirect to `/invite/{token}`. The frontend-agent updates the login flow accordingly; this is a small, one-place change documented in `03-accept-invite-page.md` §6.

---

## 6. Accessibility budget (carries forward from multi-tenancy block)

- WCAG 2.1 AA, no regressions.
- All new icon-only buttons get PT-BR `aria-label` (see spec `04-i18n-strings.md`).
- The accept page is fully keyboard-operable and uses landmark `<main>` per state.
- `role="status"` for success cards (token valid, awaiting confirmation), `role="alert"` for hard-stop states (expired, revoked, wrong-email).
- Live regions used for "Convite enviado", "Convite reenviado", "Convite revogado".

---

## 7. Risks to surface to the user before frontend-agent starts

(These are non-blocking but worth a 30-second sanity check.)

1. **Pending invites visible to members (J2)** — confirm this matches the product's confidentiality expectation. If not, flip the flag default.
2. **Inviting `member` as the default role (vs `admin`)** — spec defaults to `member`. Some products default to "same as inviter" or "admin". Confirm.
3. **Wrong-email guard wording** — "Saia desta conta" is direct but blunt. Alternative softer copy: "Entre com a conta certa para aceitar". Picking the direct version unless told otherwise.
4. **Resend rate-limit copy** — backend will rate-limit resends (e.g. 1 per minute per invite). Spec assumes the backend's error message wins; if backend just 429s with no body, frontend falls back to generic "Aguarde alguns instantes". Worth confirming the backend will return a PT-BR `error` field.

---

## 8. Spec file index

| File | Topic |
|---|---|
| `00-overview.md` | This file. Goals, stories, cross-cutting judgment calls. |
| `01-members-page-extension.md` | How the Members tab grows to host the pending list. |
| `02-invite-modal.md` | The invite-by-email modal. |
| `03-accept-invite-page.md` | Public `/invite/[token]` page, all 6 states. |
| `04-i18n-strings.md` | Every new PT-BR string keyed under `invitations.*`. |
| `05-state-and-data-flow.md` | Endpoints, query keys, hooks, optimistic logic, UI store additions. |
| `06-flows-and-errors.md` | Error mapping table, end-to-end flow examples, TypeScript type contracts. |

> Specs 05 and 06 form a pair — read both before implementing. They were split for the ~300-line file budget.
