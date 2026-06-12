# 01 — Dashboard Page

Spec status: Page-level. Replaces the placeholder `frontend/app/(authenticated)/dashboard/page.tsx`.
Depends on: `multi-tenancy-ui/00-design-tokens.md`, `01-layout-shell.md` (shell chrome), this block's `05-state-and-data-flow.md` (hooks). No backend dependency.

The dashboard is the post-login landing of a **generic SaaS starter** — its job is orientation ("where am I, who is here, what can I do next"), not analytics. Products built on the starter replace this page; everything here must be domain-free.

---

## 1. Route & component split

- Route stays `/dashboard` (org-agnostic URL; the active org comes from `currentOrganizationId`, same resolution the Shell already does). Sidebar nav item already points here.
- `page.tsx` stays a thin Server Component that renders `<DashboardView />`.
- `DashboardView` is a Client Component in `app/(authenticated)/dashboard/_components/DashboardView.tsx` — it needs `useMe`, the active-org resolution and TanStack queries. Sub-components in the same `_components/` folder: `StatCard.tsx`, `QuickActionCard.tsx`, `DashboardSkeleton.tsx`. Each ≤ 200 lines (convention).

---

## 2. Layout (desktop ≥ lg)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Boa tarde, Joana                                                        │  ← h1
│  Aqui está um resumo de Acme Brasil.                                     │  ← subtitle
│                                                                          │
│  Visão geral                                                             │  ← h2
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ │
│  │ 👥 Membros    │ │ ✉ Convites    │ │ 🛡 Sua função │ │ 📅 Criada em │ │
│  │               │ │   pendentes   │ │               │ │              │ │
│  │     24        │ │      3        │ │     Dono      │ │ 12 de março  │ │
│  │               │ │               │ │               │ │   de 2026    │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ │
│                                                                          │
│  Ações rápidas                                                           │  ← h2
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────────────┐ │
│  │ ✚ Convidar membro   │ │ ⚙ Configurações     │ │ ▦ Nova organização │ │
│  │ Chame alguém para   │ │ Nome, identificador │ │ Crie outro espaço  │ │
│  │ o seu time.         │ │ e membros.          │ │ de trabalho.       │ │
│  └─────────────────────┘ └─────────────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

Page container: the shell already provides `max-w-7xl px-4 py-6 lg:px-6 lg:py-8`. Inside it, vertical rhythm `flex flex-col gap-8`.

### Responsive grid (mobile-first)

| Section | Base (< 640) | `sm:` (≥ 640) | `lg:` (≥ 1024) |
|---|---|---|---|
| Stat cards | `grid grid-cols-1 gap-4` | `grid-cols-2` | `grid-cols-4` |
| Quick actions | `grid grid-cols-1 gap-4` | `grid-cols-2` | `grid-cols-3` |

When the invite quick action is hidden (member viewer, §5), the remaining two cards simply fill the grid — no re-balancing needed.

---

## 3. Header (greeting)

- `h1`: `text-2xl font-bold text-text-primary`. Content: contextual greeting + first name.
  - 05:00–11:59 → "Bom dia"; 12:00–17:59 → "Boa tarde"; otherwise → "Boa noite". Computed client-side (the component is client-only; no hydration mismatch risk).
  - Name: first word of `user.name`; if `name` is null/blank, render the greeting alone ("Boa tarde") — never fall back to the raw email in a headline.
- Subtitle: `mt-1 text-sm text-text-muted` — `Aqui está um resumo de ${orgName}.`
- No avatar/illustration. The topbar already shows identity.

---

## 4. Stat cards ("Visão geral")

Section heading `h2`: `text-lg font-semibold text-text-primary`.

### Anatomy (shared)

Card: `rounded-lg border border-border bg-surface-elevated p-4 lg:p-5 flex flex-col gap-2`.

```
┌────────────────────────────┐
│ [icon 16px]  Membros       │  ← label row: text-sm text-text-muted, icon text-text-muted
│                            │
│ 24                         │  ← value: text-2xl font-bold text-text-primary tabular-nums
└────────────────────────────┘
```

Icons (Lucide, `h-4 w-4`, `aria-hidden="true"`): `Users`, `MailPlus`, `ShieldCheck`, `CalendarDays`.

### The four cards

| Card | Label | Value | Source | Link? |
|---|---|---|---|---|
| Members | "Membros" | `meta.total` from `useMembers(orgId, { page: 1 })`, formatted with `Intl.NumberFormat('pt-BR')` | `GET /organizations/{id}/members` | yes → `/org/{slug}/settings/members` |
| Pending invites | "Convites pendentes" | `meta.total` from `useInvitations(orgId)` (backend defaults to `status=pending`) | `GET /invitations` | yes → `/org/{slug}/settings/members` |
| Role | "Sua função" | `t.orgs.roleFull[role]` ("Proprietário" / "Administrador" / "Membro") | `membership.role` (already in `['me']` cache — free) | no |
| Created | "Criada em" | `Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(org.created_at))` | `useOrganization(orgId)` | no |

Pending invites card is visible to **all roles** — read transparency follows `invitations-ui/00-overview.md` J2.

### Link-card behavior (Members, Convites pendentes)

The whole card is a single `<Link>` (`next/link`) whose accessible name is `"{label}: {value}. Ver detalhes."` via visible content + `sr-only` suffix ("Ver detalhes").

| State | Visual |
|---|---|
| Default | as anatomy above |
| Hover | `border-strong` + `bg-surface-sunken` transition `duration-fast ease-standard` |
| Focus-visible | `outline-none ring-2 ring-accent ring-offset-2 ring-offset-surface` |
| Active | `active:scale-[0.99]` (skip under `motion-reduce`) |

Non-link cards (Role, Created) are plain `<div>`s — no hover affordance, no `cursor-pointer` (never fake interactivity).

### Per-card loading

While its query is pending, a card renders the skeleton variant: same container, label row intact, value replaced by `h-8 w-16 rounded-md bg-surface-sunken motion-safe:animate-pulse` (matches `ShellStates.tsx` skeleton idiom). Cards resolve independently — role/created (from `me` + org) usually land before the two counts.

### Per-card error (counts only)

If `useMembers` or `useInvitations` errors after the org itself loaded:

```
┌────────────────────────────┐
│ [icon]  Membros            │
│ —   [↻ Tentar novamente]   │  ← value "—" text-text-muted; retry = icon button
└────────────────────────────┘
```

- Value: em dash, `text-2xl text-text-muted`, with `sr-only` text "Não foi possível carregar".
- Retry: icon-only button (`RotateCw`, `h-4 w-4`), `aria-label="Tentar novamente: {label}"`, ghost style, calls the query's `refetch`.
- The card stops being a link while in error (no navigation to a broken count — actually navigation still works conceptually, but keep it simple: error card is a `<div>`).

---

## 5. Quick actions ("Ações rápidas")

Section heading `h2`: `text-lg font-semibold text-text-primary`.

Card anatomy: `rounded-lg border border-border bg-surface-elevated p-4 flex items-start gap-3 text-left`.

```
┌──────────────────────────────────────┐
│ [icon 20px   ]  Convidar membro      │  ← title: text-sm font-medium text-text-primary
│ [in accent-  ]  Chame alguém para o  │  ← desc: text-sm text-text-muted
│ [soft square ]  seu time.            │
└──────────────────────────────────────┘
```

Icon container: `flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent` (icon `h-5 w-5`, `aria-hidden="true"`).

| Action | Icon | Title | Description | Behavior | Visibility |
|---|---|---|---|---|---|
| Invite | `UserPlus` | "Convidar membro" | "Chame alguém para o seu time." | `<Link>` → `/org/{slug}/settings/members` (per J3 — modal stays owned by the members page) | `owner`, `admin` only — **hidden** for `member`, not disabled |
| Settings | `Settings` | "Configurações" | "Nome, identificador e membros." | `<Link>` → `/org/{slug}/settings` | all roles |
| New org | `Plus` | "Nova organização" | "Crie outro espaço de trabalho." | `<button>` → `uiStore.openModal({ kind: 'create-org' })` (modal already mounted globally in `Shell`) | all roles |

Interactive states: identical recipe to link-cards in §4 (hover `border-strong bg-surface-sunken`, focus ring, `active:scale-[0.99]`). Link vs button is an implementation detail — visual identical; the New-org card must still be a real `<button type="button">` for semantics.

---

## 6. Page-level states

State machine, in order of precedence:

| # | Condition | Render |
|---|---|---|
| 1 | `useMe` pending | Nothing extra — the Shell already shows `ShellLoading` before children mount. If the page mounts while `me` is settled but org query pending → state 3 |
| 2 | `memberships.length === 0` | Nothing — `Shell` already swaps children for `ShellEmpty` (welcome + create CTA). The page never renders |
| 3 | Active org resolving / `useOrganization` pending | Full-page skeleton (§6.1) |
| 4 | No resolvable active org (memberships exist but `getCurrentOrgId()` matches none, post-`resolveCurrentOrgId` edge) | "Sem organização ativa" panel (§6.2) |
| 5 | `useOrganization` error | Error banner (§6.3) |
| 6 | Success | Page as specced; per-card states handle count queries |

### 6.1 Skeleton

Mirrors final layout dimensions (skeleton rule: same approximate size as real content):

- Greeting: `h-8 w-64` block + `h-4 w-80` block, `rounded-md bg-surface-elevated motion-safe:animate-pulse`.
- Stat grid: 4 cards (real container, skeleton innards per §4).
- Actions grid: 3 cards with `h-9 w-9` icon block + two text lines.
- `<span class="sr-only" role="status" aria-live="polite">Carregando…</span>` (reuse `t.shell.loading.title`).

### 6.2 No active org (edge)

Centered panel, same pattern as `ShellEmpty` but page-scoped:

```
┌──────────────────────────────────────────────┐
│        [icon: Building2, 40px, text-muted]    │
│                                              │
│        Nenhuma organização ativa             │  ← text-lg font-semibold
│   Escolha uma organização no seletor acima   │  ← text-sm text-muted
│   ou crie uma nova para começar.             │
│                                              │
│          [ + Criar organização ]             │  ← primary, opens create-org modal
└──────────────────────────────────────────────┘
```

Empty state has a CTA (non-negotiable rule). In practice `resolveCurrentOrgId` auto-picks the first membership, so this state is a defensive rail, not a normal path.

### 6.3 Org fetch error

Inline banner replacing both sections (greeting renders without org name: subtitle falls back to "Aqui está um resumo da sua organização."):

- Container: `rounded-lg border border-danger/40 bg-danger-soft p-4 flex flex-col sm:flex-row sm:items-center gap-3`, `role="alert"`.
- Text: "Não foi possível carregar os dados da organização." `text-sm text-text-primary`.
- CTA: `[ Tentar novamente ]` secondary button → refetches org + counts.

---

## 7. Accessibility

- Heading order: `h1` greeting → `h2` "Visão geral" → `h2` "Ações rápidas". No skipped levels; sections use `<section aria-labelledby>` pointing at their `h2`.
- Stat value + label are one accessible unit (label row first in DOM, so SR reads "Membros, 24" naturally; the `sr-only` "Ver detalhes" suffix only on link-cards).
- All icons `aria-hidden="true"`; no icon-only controls except the per-card retry button, which carries a contextual `aria-label`.
- Counts use `tabular-nums` so the layout doesn't shift between skeleton → value → refetch.
- Focus: standard ring recipe everywhere; tab order follows visual order (cards left→right, top→bottom).
- Motion: optional mount animation `animate-fade-in` on the two grids — must carry `motion-reduce:animate-none`. No staggered/sliding entrances (frequent page; > 300ms aggregate would violate the anti-pattern list).

---

## 8. Mobile mockup (< 640px)

```
┌──────────────────────────────┐
│ Boa tarde, Joana             │
│ Aqui está um resumo de Acme  │
│ Brasil.                      │
│                              │
│ Visão geral                  │
│ ┌──────────────────────────┐ │
│ │ 👥 Membros            24 │ │   (cards full width, stacked)
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ✉ Convites pendentes   3 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 🛡 Sua função        Dono│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 📅 Criada em  12/03/2026 │ │
│ └──────────────────────────┘ │
│                              │
│ Ações rápidas                │
│ ┌──────────────────────────┐ │
│ │ ✚ Convidar membro        │ │
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

Implementation freedom: on base width the stat card MAY switch to a single-row layout (label left, value right, value `text-lg`) to reduce vertical sprawl — frontend-agent's call; if taken, keep it consistent across all four cards.

---

## 9. Open judgment calls

- **Org-agnostic `/dashboard` vs `/org/[slug]/dashboard`**: kept `/dashboard` — it's the existing route, the redirect target of login/create-org flows, and the Shell already resolves the active org. Moving it under the slug is a future coherence play (spec 04 §1 hinted at it) but would touch login redirects, `ShellEmpty`, delete-org flow and the sidebar; not worth bundling here.
- **Invite quick action hidden vs disabled for members**: hidden — same doctrine as the members page "Convidar membro" button (`invitations-ui/00-overview.md`, member story). Disabled-with-tooltip advertises a capability the user can't get by clicking.
- **Per-card error vs page-level error for counts**: per-card. The org name/role/date can render fine while a count endpoint hiccups; degrading one tile beats blanking the page.
- **Time-based greeting**: uses the device clock, not `user.timezone` — the device clock is what the user's "good morning" feels like. `user.timezone` stays for server-side formatting needs.
