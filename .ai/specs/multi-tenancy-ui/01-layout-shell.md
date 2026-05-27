# 01 — Authenticated Layout Shell

Spec status: Foundation. Every authenticated page in the starter mounts inside this shell.
Route group: `app/(authenticated)/layout.tsx` (server component wrapper + a client child that owns interactive state).

> Why a route group: the marketing page (`/`), `/login`, and `/auth/*` must remain layout-less. The `(authenticated)` group co-locates protected routes (`/me`, `/org/*`, `/settings/*`) under one shell without leaking into the URL.

---

## 1. Composition diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Topbar (sticky, h-14, z-sticky, border-b border-default)               │
├──────────┬───────────────────────────────────────────────────────────────┤
│          │                                                               │
│ Sidebar  │  Main content slot                                            │
│ (w-60    │  ┌─────────────────────────────────────────────────────────┐  │
│  on ≥lg, │  │ Container max-w-7xl mx-auto p-6                         │  │
│ w-16     │  │                                                         │  │
│ collapse │  │  {children}  ← page mounts here                         │  │
│ -d, drawer  │                                                         │  │
│ on <lg)  │  │                                                         │  │
│          │  └─────────────────────────────────────────────────────────┘  │
│          │                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
```

---

## 2. Topbar spec

Element: `<header role="banner">`, `h-14` (56px), sticky top, full width, `bg-surface`, `border-b border-default`, `z-sticky`.

Layout (flex, gap-4, px-4 lg:px-6):

| Slot | Content | Behavior |
|---|---|---|
| Left | Sidebar collapse toggle (icon-only button), brand logo + wordmark | On `<lg`, toggle opens mobile drawer instead of collapsing |
| Left-center | Org switcher (spec 02) | Truncates at 240px |
| Center | Search input (visually disabled placeholder for now) | `aria-disabled="true"`, tooltip "Em breve" |
| Right | User menu (avatar 32px → dropdown) | See user menu below |

When the page scrolls > 8px, topbar gains `shadow-md` (subtle elevation cue). Use `IntersectionObserver` on a sentinel above content.

### User menu (dropdown)

Trigger: 32px avatar circle (initials from `name`, fallback email first char). Dropdown panel right-aligned, `w-56`.

Items (PT-BR):
1. Header row (non-interactive): avatar 40px + name + email (truncate).
2. `Minha conta` → `/me`
3. `Tema` → submenu `Claro / Escuro / Sistema` (radio group, persists in `useUiStore`).
4. Divider.
5. `Sair` → triggers Supabase sign-out, redirects to `/login`. Variant: danger text.

States: same as any dropdown — see section 5 below.

---

## 3. Sidebar spec

Element: `<aside role="navigation" aria-label="Navegação principal">`.

Two responsive modes:

| Viewport | Mode | Width | Persistence |
|---|---|---|---|
| `≥ lg` (1024px+) | Persistent column | Expanded `w-60` (240px) or collapsed `w-16` (64px) | `useUiStore.sidebarCollapsed` in localStorage |
| `< lg` | Off-canvas drawer | `w-72` (288px) | Hidden by default; toggle from topbar |

### Layout (expanded)

```
┌──────────────────────────┐
│ [icon] Dashboard         │  ← active row: bg-accent-soft, text-accent, left border-l-2 border-accent
│ [icon] Membros           │
│ [icon] Configurações     │
│                          │
│ ────────  spacer  ─────  │
│                          │
│ [icon] Documentação ↗    │  ← optional secondary section
└──────────────────────────┘
```

### Layout (collapsed, ≥lg only)

Only icons visible, centered, 40px tall rows. Hovering a row shows a tooltip (`Radix Tooltip`, side="right", delay 300ms) with the label.

### Nav items (placeholder list for the starter)

```
[Home]      Dashboard      → /dashboard
[Users]     Membros        → /org/[slug]/members
[Settings]  Configurações  → /org/[slug]/settings
```

Each is a `<Link>` (Next.js). Active state determined by `usePathname()` startsWith match.

### Row states

| State | Visual |
|---|---|
| Default  | `text-muted`, no bg |
| Hover    | `bg-surface-elevated`, `text-primary` |
| Focus-visible | focus ring (spec 00 §8) |
| Active (current route) | `bg-accent-soft`, `text-accent`, font-medium, left border 2px accent |
| Disabled (no active org) | `opacity-40`, `cursor-not-allowed`, `aria-disabled="true"` |

> When `currentOrganizationId` is null, all org-scoped nav rows render disabled with tooltip "Selecione uma organização".

---

## 4. Main content slot

```
<main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto">
  <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
    {children}
  </div>
</main>
```

- `tabIndex={-1}` + a skip-link at the top of the page (`Pular para o conteúdo` → `#main-content`) — first focusable element in the DOM order. Hidden until focused.
- `min-w-0` prevents flex children from forcing overflow.
- Pages own their own vertical rhythm inside this container; the shell only sets outer padding.

---

## 5. Cross-cutting interactive states

Applied to every clickable element in the shell (topbar buttons, sidebar rows, user menu items):

| State | Spec |
|---|---|
| Default | Per-component palette (see above) |
| Hover   | Background up one level (`surface` → `surface-elevated`), `transition-colors duration-fast ease-standard` |
| Focus-visible | Token focus ring (spec 00 §8) |
| Active (pressed) | `scale-[0.98]` for buttons; rows: no scale, slight bg darken |
| Disabled | `opacity-40 cursor-not-allowed pointer-events-none`, `aria-disabled="true"` |
| Loading | Inline spinner (16px) + `aria-busy="true"`; for full-shell loading see §7 |
| Error   | Inline error banner above main content (`bg-danger-soft`, `text-danger`), with retry CTA |
| Success | Toast (top-right, `z-toast`, auto-dismiss 4s, `role="status"`) |

---

## 6. Keyboard navigation contract

| Key | Action | Notes |
|---|---|---|
| `Tab` | Topbar → sidebar → main content (DOM order) | Skip-link first |
| `Shift+Tab` | Reverse | |
| `Esc` | Closes mobile drawer if open; otherwise no-op | |
| `Cmd/Ctrl+K` | **Reserved** — must `preventDefault()` only when a global handler exists. For now: no behavior, but no other component may bind it | Future command palette |
| `Cmd/Ctrl+B` | Toggle sidebar collapse (desktop) / drawer (mobile) | Convention from VS Code / Linear; document but mark optional for v1 |

Mobile drawer focus trap: when open, focus is trapped inside the aside; `Esc` or backdrop click closes and returns focus to the trigger button.

---

## 7. Shell-level states (driven by `/api/v1/me`)

The shell fetches `useMe()` (TanStack Query, see spec 05). Visual states it can be in:

### 7.1 Loading (first paint, no cached `me`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░    ░░░░░░░░░░░░░░░░          ░░░░░  ← topbar skeletons         │
├──────────┬───────────────────────────────────────────────────────────────┤
│ ░░░░░░   │                                                               │
│ ░░░░░░   │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                              │
│ ░░░░░░   │   ░░░░░░░░░░░░░░░░░░                                          │
│          │   ░░░░░░░░░░░░░░░░░░░░░░░░░░                                  │
└──────────┴───────────────────────────────────────────────────────────────┘
```

Skeleton blocks use `bg-surface-elevated` with subtle pulse (`animate-pulse`, 1.5s loop). Disable pulse under `prefers-reduced-motion`.

### 7.2 Error (network failure on `me`)

Full-shell fallback (no topbar/sidebar yet — they need `me` to render):

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                       [icon: cloud-off, 48px, text-muted]                │
│                                                                          │
│                   Não foi possível carregar seu perfil                   │  ← text-xl text-primary
│                                                                          │
│           Verifique sua conexão e tente novamente em alguns instantes.   │  ← text-sm text-muted
│                                                                          │
│                          [ Tentar novamente ]                            │  ← accent button, calls refetch()
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

If the error is 401 (token expired): silently redirect to `/login?reason=expired` instead.

### 7.3 Empty (logged in, zero memberships) — ADR-012 case

Shell still renders, but:
- Topbar org switcher shows **"Criar organização"** CTA button (variant: accent) instead of the switcher trigger.
- Sidebar nav items all disabled (see §3 disabled state).
- Main content renders a welcome empty state:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                     [illustration: 64px, text-muted]                     │
│                                                                          │
│                 Bem-vindo(a) ao [Nome do produto]                        │  ← text-2xl text-primary, font-bold
│                                                                          │
│        Para começar, crie sua primeira organização ou aguarde um         │  ← text-base text-muted, max-w-md
│                       convite de um administrador.                       │
│                                                                          │
│           [ + Criar organização ]   [ Aguardar convite ]                 │
│              (accent primary)        (secondary, opens info modal       │
│                                       explaining invites)                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Clicking the primary CTA opens the create-org modal (spec 03). The "Aguardar convite" button opens a small info dialog explaining that an admin from their org must invite them (no action, dismiss only).

### 7.4 Normal (has memberships)

Topbar org switcher shows the active org (read from `localStorage.currentOrganizationId`; if absent or stale, default to the first membership in `me.memberships`). Sidebar enabled. Page renders normally.

---

## 8. Mobile mockup (< lg, drawer closed)

```
┌────────────────────────────────────────────┐
│ [≡]  Acme Inc ▾        🔍   [👤]          │  ← topbar; ≡ opens drawer
├────────────────────────────────────────────┤
│                                            │
│   {page content, full width}               │
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

Drawer open (overlays content):

```
┌──────────────┐━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
│  Logo    [×] │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃
│              │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃  ← backdrop, bg-overlay
│  Dashboard   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃    click = close
│  Membros     │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃
│  Config.     │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃
│              │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┃
└──────────────┘━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Slide-in animation: `transform: translateX(-100%)` → `0` over `motion-base` with `ease-entry`. Backdrop fades `opacity 0 → 1`. Reverse on close.

---

## 9. Desktop mockup (≥ lg, sidebar expanded)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [≡] Logo  Acme Inc ▾        🔍 (Pesquisar — em breve)                  [👤]     │
├────────────────────┬─────────────────────────────────────────────────────────────┤
│ ▣ Dashboard        │                                                             │
│ ◐ Membros          │     {page content}                                          │
│ ⚙ Configurações    │                                                             │
│ ────────────────── │                                                             │
│ 📘 Documentação ↗ │                                                             │
│                    │                                                             │
└────────────────────┴─────────────────────────────────────────────────────────────┘
   240px               flex-1, max-w-7xl centered
```

Sidebar collapsed (≥ lg, user toggled):

```
┌────┬─────────────────────────────────────────────────────────────────────────────┐
│ ≡  │ Logo                                                                        │
├────┤                                                                             │
│ ▣  │   {page content}                                                            │
│ ◐  │                                                                             │
│ ⚙  │                                                                             │
│    │                                                                             │
└────┴─────────────────────────────────────────────────────────────────────────────┘
  64px
```

---

## 10. Implementation notes for `frontend-agent`

Recommended file layout:

```
app/
  (authenticated)/
    layout.tsx              ← server component: gates auth (Supabase server client), renders <Shell>
    _components/
      shell.tsx             ← client component, owns useMe() + useUiStore
      topbar.tsx
      sidebar.tsx
      user-menu.tsx
      skip-link.tsx
      shell-loading.tsx
      shell-error.tsx
      shell-empty.tsx
    dashboard/page.tsx      ← placeholder for the starter
    org/[slug]/...
```

The server `layout.tsx` does: `const session = await getSession(); if (!session) redirect('/login')`. Then mounts `<Shell>{children}</Shell>`. Everything interactive (drawer toggles, theme, org switcher) lives in `<Shell>` and below.

---

## 11. Open judgment calls

- **Sidebar width 240px vs 256px**: 240 reads slightly tighter on 13" laptops; 256 is the Tailwind native `w-64`. Picked 240 (`w-60`) — call this out so the frontend-agent doesn't autopilot to `w-64`.
- **`Cmd+B` binding**: included as optional because the starter has no users yet. Frontend-agent may defer if it slows initial implementation.
- **Theme submenu vs dedicated settings**: chose submenu inside user menu for speed-to-toggle. If a global settings page exists later, mirror the control there.
