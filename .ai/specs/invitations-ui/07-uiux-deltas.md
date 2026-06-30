# 07 — UI/UX Deltas (review notes for frontend-agent)

Spec status: **Read-only delta**. Audits specs 00–06 against the established design system from `multi-tenancy-ui/00-design-tokens.md` and the components shipped in commit `a27358b`. Does not replace any spec — call out implementation guardrails only.

Audience: `frontend-agent` (consult before implementing), `review-agent` (verifies these points were respected).

---

## 1. Tokens — no additions needed

Audit result: **no new tokens required**. Every color, motion, radius, z-index, and type-size referenced across specs 01–03 maps to an existing token. Specifically:

- `bg-warning-soft`, `text-warning` (spec 03 §3.6) — exist (`multi-tenancy-ui/00 §1`).
- `bg-accent-soft`, `border-accent` (spec 02 §3.2 role cards) — exist.
- `bg-danger-soft`, `border-danger` (spec 02 §6, 03 §3.7 inline banners) — exist.
- `motion-fast` / `motion-base` (specs 01 §4, 03 §5) — exist (`multi-tenancy-ui/00 §6`).
- `z-modal` / `z-toast` (no new layers) — sonner already mounted at `z-toast`.

Action: do not edit `tailwind.config.ts` or `globals.css` for this block.

---

## 2. Primitives — one missing dependency, rest reusable

| Primitive | Spec usage | Status |
|---|---|---|
| Dialog | invite modal (02), revoke confirm (01 §4) | **Exists**: `components/ui/ConfirmDialog.tsx` + Radix Dialog dep. The invite modal is a non-confirm Dialog; frontend-agent extracts the Dialog primitive from ConfirmDialog into a small `Dialog.tsx` wrapper, then composes both ConfirmDialog and the new InviteModal on top. Do NOT build a second Radix Dialog shell. |
| DropdownMenu | actions menu in pending row (01 §4) | **Exists**: already used in `MemberRow.tsx` via `@radix-ui/react-dropdown-menu`. Reuse the same composition (`Root` → `Trigger asChild` → `Portal` → `Content`). |
| RadioGroup (segmented) | invite modal role select (02 §3.2) | **MISSING**: `@radix-ui/react-radio-group` not in `package.json`. Frontend-agent must `npm install @radix-ui/react-radio-group` and create `components/ui/RadioCardGroup.tsx` styled per spec 02 §3.2. Single tab-stop, arrow keys cycle (Radix default). |
| Toast | sentToast, revokedToast, resentToast | **Exists**: `sonner` installed. Ensure the Toaster is mounted with `richColors`-equivalent variant mapping for `success`/`error` matching token colors. |
| Avatar / RoleBadge | not used directly here (spec 01 §3 uses RoleBadge) | **Exists**: `components/ui/RoleBadge.tsx`. Reuse with `role: 'member' \| 'admin'`. |
| Tooltip | inviter "Não é mais membro." (01 §3), expires-in full date (01 §3) | **Exists**: `@radix-ui/react-tooltip` already in deps. No new primitive needed. |
| Skeleton | pending list loading (01 §5) | Not a primitive — inline `bg-surface-sunken rounded-sm animate-pulse motion-reduce:animate-none` block per spec. No file needed. |
| Banner (inline error) | spec 02 §6, 03 §3.7 | Not a primitive — inline `bg-danger-soft border border-danger text-danger px-3 py-2 rounded-sm text-sm role="alert"`. No file needed. |
| Live region | announce() | **Exists**: `lib/a11y/announce.ts` writes into `#shell-live`. The accept page (`/invite/[token]`) sits OUTSIDE the authenticated shell — it has no `#shell-live`. See §3.

---

## 3. Loading / empty / error states — accept page live regions

Spec 03 §3 defines all 6 states. Audit:

| State | role | Coverage |
|---|---|---|
| 3.1 ready (auth) | none (informational) | OK — visible heading hierarchy carries semantics. |
| 3.2 ready (anon) | none | OK. |
| 3.3 expired | `role="alert"` on container | OK. |
| 3.4 revoked | `role="alert"` | OK. |
| 3.5 invalid | `role="alert"` | OK. |
| 3.6 wrong-email | `role="alert"` | OK. |
| 3.7 submitting | `aria-busy="true"` on clicked button | OK. |

Gaps to fix during implementation:

- **No `#shell-live` on `/invite/[token]`** — the page is outside `(authenticated)` layout. The spec calls `announce()` on accept success (spec 05 §3.5), but the success path immediately redirects, so the announcement loses its mount before SR reads it. **Recommendation**: skip the announce on accept success (the page change + new page title is the announcement). Keep the announce for decline if the redirect target is `/` — render a `#invite-live` `aria-live="polite"` region in the public layout for the brief in-page error transitions in §3.7.
- **Card-swap on race (spec 03 §3.7, 410/422)**: when the card re-renders to Expired/Revoked/WrongEmail, the new container has `role="alert"` which announces correctly. Ensure focus also moves to the `<main>` (or the heading) on swap, otherwise keyboard users keep focus on the now-unmounted button.

---

## 4. Focus & keyboard

| Surface | Requirement | Status in specs |
|---|---|---|
| Invite modal initial focus | email input (02 §8) | Defined. |
| Invite modal restore focus | "Convidar membro" trigger (02 §7) | Defined. |
| Revoke confirm initial focus | "Cancelar" (01 §4) | Defined — matches existing ConfirmDialog default-safe pattern. |
| Revoke confirm restore | actions menu trigger if mounted, else section heading (01 §7) | Defined — handle via `onAnimationComplete` callback. |
| Pending section tab order | `[heading] → [collapse toggle] → (rows: actions menu per row) → next sibling` | **NOT explicit in spec 01**. Frontend-agent: rows themselves are NOT focusable (only the `···` button is); collapse toggle must come AFTER the heading in DOM order. Verify with Tab walk before merging. |
| Accept page focus on entry | `<main tabIndex={-1}>` (03 §7) | Defined. |
| Accept page button stacking on mobile | primary on TOP (03 §3.1, 03 §8) | Defined. Ensure visual top maps to first DOM order — flex `flex-col` works; `flex-col-reverse` would scramble tab order. |
| RadioCardGroup keyboard | arrow keys cycle, Enter selects, Enter does NOT submit (02 §3.2 keyboard) | Defined. Radix RadioGroup honors this by default — do not override. |
| Wrong-email "Sair desta conta" | button, not link (03 §3.6) | Defined. Make sure `signOut()` resolves before navigation; show `signingOut` loading state. |

---

## 5. Color & contrast — three flags

Use HSL math against the token table (`multi-tenancy-ui/00 §1`).

### 5.1 Expires-in urgency colors (spec 01 §3)

- `text-muted` on `surface-elevated` light: 4.7:1. **Pass**.
- `text-warning` (#F59E0B) on `surface-elevated` light: ~1.86:1. **FAIL** for body text (needs 4.5:1).
- `text-danger` (#DC2626) on `surface-elevated` light: ~5.9:1. **Pass**.

Action: for the "1 to 3 days" warning band, do NOT rely on `text-warning` alone. Either:
- (a) use `text-warning` PLUS `font-medium` PLUS a leading icon (`Clock`) — color becomes redundant; OR
- (b) use `text-primary` for the text and a small `bg-warning-soft px-2 py-0.5 rounded-sm` pill behind it.
Recommend (b) for simplicity; the pill is the visual signal, text contrast stays primary.

Same fix applies in dark mode — `text-warning` dark on `surface-elevated` dark ratio ~3.1:1, also fails for body text.

### 5.2 Wrong-email guard icon area (spec 03 §3.6)

Icon circle uses `bg-warning-soft` with `text-warning` icon. Icon is 48px non-text — 3:1 contrast threshold (WCAG 1.4.11 non-text). Warning on warning-soft ≈ 1.55:1. **FAIL**.

Action: keep `bg-warning-soft` for the circle, but render the icon with `text-warning` REPLACED by a darker variant — use `text-[hsl(38_92%_35%)]` inline (one-off) OR add a new token `--warning-strong: 38 92% 35%`. Recommend the inline `[hsl(...)]` — single use, no new global token.

Alternative: skip `bg-warning-soft` and place the icon directly on `surface-elevated` with `text-warning`. The 1.86:1 still fails as text but is acceptable for a 48px graphic (3:1 threshold, achieved at ~3.0:1 — borderline; verify with axe).

### 5.3 Role card subtitle on selected state (spec 02 §3.2)

Spec already flags this: `text-disabled` on `accent-soft` light (#94A3B8 on #EEF2FF) ≈ 2.1:1. **FAIL**.

Action: **always** use `text-muted` for the card subtitle, regardless of selected state. The spec's "verify ratio ≥ 4.5:1; if not, use text-text-muted" is a definitive choice — pin it to `text-muted` and remove the conditional in implementation.

---

## 6. Motion

All transitions referenced are covered by existing tokens (`motion-fast`, `motion-base`). Specifically:

- Modal entry — Radix Dialog default fade + scale, override duration with `data-[state=open]:duration-base` style attribute. Reduced-motion: opacity only (spec 02 §8).
- Toast slide-in — sonner's default `motion-base` equivalent; no override.
- Revoke row fade-out — `transition-opacity duration-base motion-reduce:duration-[1ms]` on the row wrapper.
- Collapse toggle (01 §2) — `transition-[height] duration-base` if using `<div hidden>`. Note: animating `hidden` is non-trivial — recommend just hiding without animation (the `hidden` attribute swap is instant by spec). Skip motion here.
- Card swap on accept race (03 §3.7) — no transition. Hard swap with `role="alert"` is correct.

No new motion tokens.

---

## 7. Erratas across specs (minor)

| # | Found | Recommendation |
|---|---|---|
| E1 | `01-members-page-extension.md §3` references "role-badge component from spec 02 §2.3 (multi-tenancy)" — but spec 02 of THIS block (invitations) has no §2.3. | Treat as a typo for `multi-tenancy-ui/02 §2.3`. The `RoleBadge` component already exists at `components/ui/RoleBadge.tsx`. Reuse as-is. |
| E2 | `02-invite-modal.md §3.2` references default role decision at "J in 00-overview §7.2" — but `00-overview.md §7` is a risk list, not a pinned J-decision. | Treat the default `member` as pinned by spec 02 itself; risk §7.2 just acknowledges alternatives. No spec change. |
| E3 | `00-overview.md §3` ("Invitee with no account accepts" step 6) says "auth callback notices the `?invite=` param and redirects back to `/invite/{token}`", but spec 03 §6 specifies the **login page** does this redirect, not the Supabase auth callback. | Both are needed in practice (the email-confirmation callback URL is built by Supabase config). Frontend-agent implements both touch-points; flag any Supabase-side config change to the orchestrator before merging. |
| E4 | `06-flows-and-errors.md §1` row for 410 says "Swap accept page to Expired card", but the code on a 410 could be `invitation_revoked` (per spec 04 §5 codes). | Switch on `body.code` first, then status. If code is `invitation_revoked`, render Revoked card; if `invitation_expired` or unknown 410, render Expired card. |
| E5 | `05-state-and-data-flow.md §1` table says GET /invitations/accept/{token} "Auth: Optional", but spec 03 §1 reads session via `@supabase/ssr` to determine email-match. | Consistent — auth is optional for the endpoint, but the page logic reads the session independently from cookies. No conflict. |

None of these block implementation. All are documentation tidy-ups for v2.

---

## 8. A11y checklist for frontend-agent (gate before closing implementation)

Run through this list before handing off to `review-agent`:

1. **No raw palette classes** added in any new component (no `text-blue-600`, `bg-zinc-*`, etc.) — only semantic tokens from `multi-tenancy-ui/00`.
2. **`@radix-ui/react-radio-group` installed** and the new `RadioCardGroup` lives under `components/ui/` (not co-located with the modal — it is reusable).
3. **Focus ring visible** on every new interactive element (`focus-visible:ring-2 ring-accent ring-offset-2 ring-offset-surface`) — verified by Tab walk through pending section, invite modal, and accept page.
4. **Focus restoration**: closing the invite modal returns focus to the `Convidar membro` trigger; closing the revoke confirm returns focus to the row's `···` button (or the section heading if the row unmounted).
5. **No reliance on color alone** for "expires in 1–3 days" — apply §5.1 (b) (background pill) so red/yellow/gray is visually redundant with text/icon.
6. **Touch targets ≥ 40×40** for collapse toggle, actions menu trigger, dialog close — measured, not eyeballed.
7. **`role="alert"`** present on Expired / Revoked / Invalid / WrongEmail card containers on the accept page; **`role="status"`** on success toasts (sonner does this by default — verify the `<Toaster />` mount uses default roles).
8. **`aria-busy="true"`** on the submit button during `useCreateInvitation` mutation; on `Aceitar` during `useAcceptInvitation`; on the `···` trigger during `useResendInvitation`. Verified each button's label changes to its `-ing...` form during the busy state (spec 04 has all the keys).
9. **`prefers-reduced-motion`** respected: modal scale transition becomes opacity-only; row fade-out collapses to `1ms`; skeleton pulse pauses (`motion-reduce:animate-none`).
10. **PT-BR strings** all sourced from `t.invitations.*` — no inline string literals. The dict file matches the contract in `04-i18n-strings.md`.
11. **Keyboard parity for actions menu**: `Enter`/`Space` opens, `↓`/`↑` navigates, `Esc` closes, `Tab` exits — same as the existing members list menu (no custom keyboard handlers added).
12. **No autofocus on close button** in the invite modal — initial focus must land on the email input (spec 02 §8).

If any item fails, fix before requesting review. Each maps to a section of the source specs; do not relitigate decisions, only enforce.
