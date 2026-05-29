# 01 — Members Page Extension: Pending Invitations

Spec status: Page-level. Extends `multi-tenancy-ui/04-org-settings-page.md` §4 (Members tab).
Depends on: `multi-tenancy-ui/00-design-tokens.md`, `multi-tenancy-ui/05-state-and-data-flow.md`, `multi-tenancy-ui/06-accessibility-and-i18n.md`.

> This spec ADDS to the existing Members tab. It does NOT redesign the existing members list. Treat the existing list as immutable surface; the pending section is a new sibling below it.

---

## 1. Route

Same as before — `/org/[slug]/settings/members`. No new route, no new tab. The page now renders:

1. Members section (existing — `multi-tenancy-ui/04` §4).
2. Pending Invitations section (new — this spec).

---

## 2. Layout decision: contiguous section, not sub-tab

Per `00-overview.md` §5 J1: a contiguous section, separated by a `gap-8` from the members list. NOT a sub-tab.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configurações                                                          │
│  Gerencie sua organização e seus membros.                               │
│                                                                         │
│  ◉ Geral    ○ Membros                                                   │
│                                                                         │
│  Membros (24)                                                           │
│  [🔍 Buscar...]  [Função: Todas ▾]              [ + Convidar membro ]  │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ … existing members list (multi-tenancy-ui/04 §4) …               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  — gap-8 —                                                              │
│                                                                         │
│  Convites pendentes (3)                                  [ Ocultar ▴ ] │  ← collapse toggle
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ bruno@acme.com         Admin    convidado por Joana   em 6 dias  │·│
│  │ ana@acme.com           Membro   convidado por Pedro   em 3 dias  │·│
│  │ ze@acme.com            Membro   convidado por Joana   em 1 dia   │·│
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Header

- `text-lg font-semibold text-primary` — "Convites pendentes ({n})".
  - When `n === 0`, the header still renders ("Convites pendentes") to make the section discoverable even when empty.
- Collapse toggle on the right: icon-button using a chevron (`ChevronUp` / `ChevronDown` from lucide-react). `aria-label="Ocultar convites pendentes"` / `"Mostrar convites pendentes"`. Default state:
  - `expanded` when `n <= 5`.
  - `collapsed` when `n > 5`. (Surfaces the count without flooding the page.)
  - User preference persists in `useUiStore` under `invitationsSectionCollapsed: boolean | null` (null = use default).
- The "Convidar membro" button **stays in the Members section header** (not duplicated here). Reason: a single CTA per page keeps the intent legible.

### Card chrome

Identical to the members list card: `bg-surface-elevated border border-default rounded-md`, rows separated by `divide-y divide-default`. Row padding `px-4 py-3`. `flex items-center gap-4`.

---

## 3. Row anatomy

Each row represents one pending invitation.

| Column | Width | Content | Style |
|---|---|---|---|
| 1. Email | `flex-1 min-w-0` | `bruno@acme.com` | `text-sm font-medium text-primary truncate` |
| 2. Role badge | `w-20` | "Admin" / "Membro" | Reuse role-badge component from spec 02 §2.3 (multi-tenancy). `owner` is impossible here (cannot invite as owner). |
| 3. Inviter | `hidden md:flex w-40 min-w-0` | "convidado por Joana" | `text-xs text-muted truncate`. The word "convidado por" is `text-text-disabled` for visual de-emphasis; the name is `text-text-muted`. Mobile: hidden. |
| 4. Expires-in | `w-24` | "em 6 dias" | `text-xs text-muted tabular-nums`. Computed via `Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' })`. Tooltip on hover shows full timestamp (`Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })`). |
| 5. Actions menu | `w-10` | `···` icon button | Reuses the existing actions-menu pattern from members list. `aria-label={t.invitations.list.actionsMenu(email)}`. |

### Expiry visual emphasis

The expires-in column changes color based on urgency:
- `> 3 days`: `text-muted`.
- `1 to 3 days`: `text-warning`.
- `< 24h`: `text-danger` and the text is `font-medium`.
- This is purely a visual aid — the server is the source of truth for actual expiry.

### Mobile layout (< md)

```
┌──────────────────────────────────────┐
│ bruno@acme.com                   ··· │
│ Admin · em 6 dias                    │
└──────────────────────────────────────┘
```

- Email on line 1.
- Role + dot separator + expires-in on line 2.
- Inviter is dropped (available via row tap → details? — out of scope; spec keeps mobile minimal).
- Actions menu stays in the top-right of the row.

---

## 4. Actions menu

The `···` button opens a Radix DropdownMenu with these items, in this order:

| Item | Visible to | Style | Action |
|---|---|---|---|
| Reenviar convite | owner, admin | default | POST `/api/v1/invitations/{id}/resend` |
| Revogar convite | owner, admin | danger variant (red text) | Open confirm dialog → DELETE `/api/v1/invitations/{id}` |

For `member` viewer (per J2 in 00-overview): the actions menu trigger (`···`) is **not rendered**. The row is read-only.

### Reenviar

- No confirm dialog (non-destructive).
- The menu closes immediately on click.
- Per-row visual: the `···` trigger becomes `aria-busy="true"` and shows an inline spinner replacing the icon for the duration of the request.
- On success: toast `t.invitations.list.resentToast(email)` ("Convite reenviado para X"). The expires-in column updates to "em 7 dias" via cache invalidation.
- On error: toast with backend's PT-BR error or fallback "Não foi possível reenviar o convite." The row is unchanged.
- Rate-limit handling (429): toast title "Aguarde para reenviar", body uses backend `error` field if present, else "Você já reenviou este convite recentemente."

### Revogar

Confirm dialog (Radix Dialog, same primitive as the existing confirm-remove-member dialog in `multi-tenancy-ui/04`):

```
┌──────────────────────────────────────────────────────┐
│ Revogar convite?                                 [×] │
│                                                      │
│ O link enviado para bruno@acme.com deixará de        │
│ funcionar imediatamente. Você pode enviar um novo    │
│ convite a qualquer momento.                          │
│                                                      │
│                   [ Cancelar ]   [ Revogar ]         │  ← Revogar = danger variant
└──────────────────────────────────────────────────────┘
```

- Default focus: Cancelar (safe-default — matches existing pattern in `multi-tenancy-ui/04` §3 confirm dialogs).
- ESC closes. Click outside closes.
- Revogar button shows loading state on click: spinner + "Revogando...".
- On success: dialog closes, row fades out over `motion-base`, toast `t.invitations.list.revokedToast`.
- On error: dialog stays open, error banner inside the dialog (`bg-danger-soft border border-danger text-danger px-3 py-2 rounded-sm`), button re-enabled.
- Optimistic update: row is removed from the list immediately on confirm; if the server errors, the row is restored and the dialog re-opens with the error banner. (See `05-state-and-data-flow.md` §3.3.)

---

## 5. States

### Loading (initial fetch of pending invitations)

Inline skeleton — 3 rows of:
```
┌──────────────────────────────────────────────────┐
│ ▪▪▪▪▪▪▪▪▪▪▪▪▪  ▪▪▪  ▪▪▪▪▪▪▪▪▪▪▪  ▪▪▪▪▪▪    ···  │
└──────────────────────────────────────────────────┘
```
- Skeleton blocks: `bg-surface-sunken rounded-sm animate-pulse motion-reduce:animate-none`.
- Heights match the live row.
- Even during loading, the section header renders with "Convites pendentes" (no count yet).

### Loaded — empty (no pending invites)

The collapsible body, when expanded, shows:
```
┌────────────────────────────────────────────────────┐
│                                                    │
│         Nenhum convite pendente.                   │
│                                                    │
│  Use o botão "Convidar membro" acima para começar. │
│                                                    │
└────────────────────────────────────────────────────┘
```

- `text-sm text-muted`, centered, vertical padding `py-8`.
- The "use o botão" line is `text-xs text-disabled` — gentle pointer, not a CTA.
- **No duplicate "+ Convidar membro" button here** — there's already one in the Members section header above. Avoid the dead-end-button anti-pattern: empty states must have a CTA UNLESS another CTA already covers the action within the same viewport.
- For visual breathing, a small users-plus icon (`UserPlus2` 32px, `text-disabled`) sits above the text.

### Loaded — populated

The list as described in §3.

### Error (fetch failed)

```
┌────────────────────────────────────────────────────┐
│            [icon: cloud-off, 40px, text-muted]     │
│                                                    │
│    Não foi possível carregar os convites.          │
│                                                    │
│              [ Tentar novamente ]                  │
└────────────────────────────────────────────────────┘
```

- Same shape as the members list error state (`multi-tenancy-ui/04` §4.6) — consistency over novelty.
- Retry button: variant `secondary`, refetches the pending invitations query only (not the members list).
- The members list above continues to function normally; an error in one section doesn't break the other.

### Per-row updating

- Resending: actions trigger shows spinner. Row otherwise unchanged.
- Revoke confirmed (optimistic): row gets `opacity-70`, fades out over `motion-base`, then unmounts. On rollback (error), the row fades back in.

---

## 6. Invite CTA placement & gating

The "Convidar membro" button:
- Lives in the **Members section header** (existing surface from `multi-tenancy-ui/04` §4 toolbar), NOT in the pending section.
- Visible only to `owner` and `admin`. Fully hidden for `member`.
- Click → opens the Invite modal (spec 02).
- Disabled state (rare): if the org has hit a quota (e.g. backend returns a flag `quota_exceeded`), the button stays visible but disabled with a tooltip "Limite de membros atingido. Atualize o plano." For v1 the starter has no plan/quota concept — design this disabled state but flag as unused.

> Note: `multi-tenancy-ui/04` §4.2 originally said the invite button could be hidden for v1 because backend wasn't ready. With this spec block, the button is **wired** and visible to owner/admin. The "Em breve" placeholder is removed.

---

## 7. Accessibility

- The pending section is wrapped in a `<section aria-labelledby="pending-invites-heading">` with the count heading as `<h2 id="pending-invites-heading">`.
- Each row is a `<li>` inside `<ul role="list">`. The whole row is not a button — only the actions menu is interactive (consistent with the members list).
- Collapse toggle: uses `aria-expanded={isExpanded}` and `aria-controls="pending-invites-list"` on the toggle button; the list region has `id="pending-invites-list"` and is hidden via `hidden` attribute when collapsed (not `display: none` — the `hidden` HTML attribute is announced correctly by SR).
- Actions menu reuses the keyboard map from `multi-tenancy-ui/06` §2 (Enter/Space opens, ↓/↑ navigates, Esc closes).
- After a successful revoke, the focus returns to the actions menu trigger if it still exists, else to the section heading. Since the row unmounts, focus must move — handle via `onAnimationComplete` → focus the heading.
- Live region announcement on revoke success: "Convite para X revogado." On resend success: "Convite reenviado para X."
- Touch targets: actions menu trigger 40×40, collapse toggle 40×40.

---

## 8. Responsive specifics

- **Mobile (< md)**: row hides Inviter column (per §3 mobile layout). Section header keeps the count and toggle.
- **Tablet (md to lg)**: all columns visible, Inviter column truncates at `w-32`.
- **Desktop (≥ lg)**: full row.
- The members list above already has its own responsive rules from `multi-tenancy-ui/04`; this section uses the same `md` and `lg` breakpoints to stay visually aligned.

---

## 9. Edge cases

- **Same email pending AND already a member**: shouldn't happen (backend prevents). If it does, the pending row still renders; revoke is the recovery path.
- **Pending invite from a removed inviter**: if the user who created the invite has been removed from the org, the inviter column shows their name with a tooltip "Não é mais membro." but the invite remains valid (the org owns it, not the inviter).
- **Pagination**: pending invitations are unpaginated for v1 (assume small N). If a future product has 100+ pending invites, switch to a `?page=` pattern matching the members list. The endpoint already supports it (`05-state-and-data-flow.md` §1); the UI currently fetches the first page only and shows "+ Ver mais" if `meta.last_page > 1`. Flag as TODO.
- **Realtime updates**: out of scope. The list refetches on `refetchOnWindowFocus` (already configured globally) and after any mutation.

---

## 10. Open judgment calls

- **Collapse toggle default threshold (5 rows)** — arbitrary. 3 or 10 also defensible. Picked 5 because it's roughly one screenful on a 13" laptop.
- **Inviter column on mobile** — dropped entirely. Alternative: keep it on a third line. Chose to drop for cleanliness; spec note says it can come back as a row-tap details sheet in a future iteration.
- **Resend cooldown surfacing** — relying on backend's 429 message. If the backend doesn't return a cooldown remaining (e.g. "tente novamente em 32s"), the UI just shows a generic message. Worth confirming with backend-agent.
- **Showing inviter at all** — some products consider this a privacy leak across an org. We chose to surface it because in-org transparency is a feature, not a leak. If the future product disagrees, hide via a config flag (`config.invitations.showInviter`).
