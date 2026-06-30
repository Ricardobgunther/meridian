# 02 — Organization Switcher

Spec status: High-visibility component. Sits in topbar, drives the entire authenticated experience.
Depends on: spec 00 (tokens), spec 01 (topbar slot), spec 05 (state).

---

## 1. Trigger (in topbar)

Visible state when at least one org exists:

```
┌────────────────────────────────────────────┐
│ [AB]  Acme Brasil ▾                        │   max-w-60 (240px), truncate
└────────────────────────────────────────────┘
   32px avatar    org name      caret
```

### Anatomy

| Part | Spec |
|---|---|
| Avatar (left) | 32px circle, `rounded-pill`, initials (first 2 chars of org name, uppercase). Background color derived from a hash of `org.id` mapped to one of 8 preset HSL hues (see §6). Text: `text-accent-foreground`, `font-medium`, `text-xs`. |
| Name (center) | `text-sm font-medium text-primary`, single line, `truncate`, `max-w-40` (160px) |
| Caret (right) | `lucide-react` `ChevronDown` 16px, `text-muted`, rotates 180° on open with `transition-transform duration-fast` |
| Spacing | gap-2, padding `px-2 py-1`, `rounded-md` |
| Container | `flex items-center`, `hover:bg-surface-elevated`, focus ring per token, `aria-haspopup="listbox"`, `aria-expanded={open}` |

### Empty state — no organizations (ADR-012)

Trigger replaced by an accent button:

```
┌──────────────────────────┐
│ + Criar organização      │
└──────────────────────────┘
```

- Variant: primary accent (`bg-accent text-accent-foreground`)
- Click opens the create-org modal (spec 03)
- Sidebar is in disabled state in parallel (spec 01 §3)

### Loading state (no `me` data yet)

Trigger replaces content with a skeleton: 32px circle + `w-32 h-4` rounded bar, both with `animate-pulse`. The button itself stays in DOM with `aria-busy="true"` and `cursor-wait`, but is not clickable.

### States

| State | Visual |
|---|---|
| Default | Transparent bg, hover bumps to `surface-elevated` |
| Hover   | `bg-surface-elevated` |
| Focus-visible | Focus ring (token) |
| Active (panel open) | `bg-surface-elevated`, caret rotated 180° |
| Disabled (no orgs / pending org switch) | `opacity-60 cursor-not-allowed`, `aria-disabled="true"` |
| Loading | Skeleton, `aria-busy="true"` |
| Error  | Trigger renders, but red dot indicator (8px) appears top-right of avatar; tooltip shows "Erro ao carregar organizações — clique para tentar de novo" |

---

## 2. Dropdown panel

Width `w-[300px]`, max-height `420px`. Anchored beneath the trigger, aligned to its left edge (`align="start"` in Radix Popover). Offset 4px from trigger.

Visual: `bg-surface-elevated`, `border border-default`, `rounded-lg`, `shadow-lg`, `z-dropdown`.

### Panel layout

```
┌────────────────────────────────────────────┐
│ Suas organizações                          │  ← section header
│  ┌──────────────────────────────────────┐  │
│  │ 🔍  Buscar organização               │  │  ← only if ≥ 8 orgs
│  └──────────────────────────────────────┘  │
│                                            │
│ [AB] Acme Brasil          [owner]   ✓     │  ← active row
│ [GS] Globex SaaS          [admin]         │
│ [WE] Widget Energy        [member]        │
│ [MM] My Med Tech          [owner]         │
│                                            │
│ ──────────────────────────────────────     │
│                                            │
│  + Criar organização                       │
└────────────────────────────────────────────┘
```

### Sections

#### 2.1 Header

`px-3 pt-3 pb-2`, `text-xs font-medium text-muted uppercase tracking-wide`. Text: "Suas organizações".

#### 2.2 Search input (conditional)

Renders only when `me.memberships.length >= 8`. Input: `text-sm`, ghost variant (no border, `bg-surface-sunken`), leading search icon 16px, placeholder "Buscar organização". Filters the list by substring against `organization.name` (case-insensitive, accent-insensitive — use `String.prototype.normalize('NFD').replace(/\p{Diacritic}/gu, '')`).

`role="searchbox"`, `aria-controls="org-listbox"`.

#### 2.3 Org list (`role="listbox"`)

Each row:

```
┌────────────────────────────────────────────┐
│ [AB] Acme Brasil          [owner]   ✓     │
└────────────────────────────────────────────┘
   |    |                    |        |
   32px avatar  name (flex-1, truncate)
                             role badge   check (only if active)
```

Row anatomy:
- Padding `px-3 py-2`, `gap-3`, `flex items-center`, `rounded-md`
- Avatar: 28px circle (smaller than trigger avatar), same hashed-color scheme
- Name: `text-sm text-primary`, truncate, `flex-1`
- Role badge: `text-xs font-medium`, `rounded-pill`, `px-2 py-0.5`, color per role:
  - `owner` → `bg-accent-soft text-accent`
  - `admin` → `bg-info-soft text-info`
  - `member` → `bg-surface-sunken text-muted`
- Active check: `lucide-react` `Check`, 16px, `text-accent`, only on the currently active org

Role labels (PT-BR display only): `owner → Proprietário`, `admin → Administrador`, `member → Membro`. But the badge body text is short so we use abbreviations: `Prop.`, `Admin`, `Membro`. (Final: keep `Admin` and `Membro` since they're already short; `Proprietário` is too long → use `Owner`-style short form: **"Dono"** for the badge. Decision: use `Dono`, `Admin`, `Membro` for badge brevity. Tooltip on hover shows the full word.)

Row states:
| State | Visual |
|---|---|
| Default | Transparent bg |
| Hover   | `bg-surface-sunken` |
| Focus-visible (keyboard nav) | `bg-surface-sunken` + focus ring inset |
| Active (the current org) | `bg-accent-soft`, `text-accent` on name, check icon visible |
| Disabled (switch in progress for this row) | `opacity-50`, `aria-busy="true"`, spinner replaces check |

#### 2.4 Divider

`<hr>` (semantic), `border-t border-default`, `mx-3 my-1`.

#### 2.5 Create-org action

```
┌────────────────────────────────────────────┐
│  +  Criar organização                      │
└────────────────────────────────────────────┘
```

- Full-width button-row, `px-3 py-2`, `gap-3`, `rounded-md`
- `+` icon 16px (`Plus`), `text-accent`
- Label: `text-sm font-medium text-accent`
- Hover: `bg-accent-soft`
- Focus-visible: focus ring
- On click: closes the panel, opens the create-org modal (spec 03)

---

## 3. Active-org persistence + switch mechanism

### Storage
- Key: `localStorage.currentOrganizationId`
- Value: UUID string
- Set on: successful switch, successful create

### Resolution at app boot (in `<Shell>`)
```
1. Read currentOrganizationId from localStorage
2. Verify it exists in me.memberships
3. If not present or not a member: fall back to me.memberships[0]?.organization.id
4. If me.memberships is empty: leave null, render empty state (spec 01 §7.3)
5. Write the resolved value back to localStorage (idempotent)
```

### Switch mechanism (when user picks a different org)

```
1. Set `pendingSwitchOrgId = newId` (local state in the switcher) → row shows spinner
2. localStorage.setItem('currentOrganizationId', newId)
3. queryClient.invalidateQueries() — invalidate EVERYTHING that depends on org
   (broad invalidation is acceptable because we soft-reload anyway)
4. router.refresh() — re-runs the server components, hydrates new data
5. Close panel after step 4 (no need to await full hydration — the optimistic
   UI shows new org name immediately because the switcher reads from localStorage)
```

> Why not a full `window.location.reload()`: it flashes a white screen. `router.refresh()` keeps the shell mounted and only re-fetches data.

If step 3 or 4 errors: revert localStorage, show toast "Não foi possível trocar de organização. Tente novamente.", remove pendingSwitchOrgId.

### Boundary: avoid stale `X-Organization-Id`

The API client (spec 05 §3) reads `localStorage.currentOrganizationId` lazily on every request. No need to bake the org into a React context — the client wrapper handles it.

---

## 4. Accessibility (full ARIA combobox semantics)

### Trigger button
```
role="combobox"          ← Radix Popover.Trigger renders <button>; we add role
aria-haspopup="listbox"
aria-expanded={open}
aria-controls="org-listbox"
aria-label="Trocar organização. Atual: Acme Brasil."
```

### Search input
```
type="search"
role="searchbox"
aria-controls="org-listbox"
aria-label="Buscar organização"
autoFocus when panel opens
```

### Listbox
```
id="org-listbox"
role="listbox"
aria-label="Suas organizações"
```

### Each row
```
role="option"
aria-selected={org.id === currentOrgId}
tabIndex={-1}   ← keyboard nav handled by parent, not native tab
```

### Keyboard map (when panel open)

| Key | Behavior |
|---|---|
| `↓` / `↑` | Move focus through options (wraps at ends) |
| `Home` / `End` | Jump to first / last option |
| `Enter` / `Space` | Activate focused option = switch to that org |
| `Esc` | Close panel, return focus to trigger |
| `Tab` / `Shift+Tab` | Close panel, move focus to next/prev page element |
| Printable chars | When no search box (< 8 orgs): typeahead — focus jumps to next option whose name starts with the typed string. Reset typeahead after 500ms idle. |
| Typing in search | Filters list, focus stays in search; `↓` from search moves focus to first visible option |

### Focus trap

While the panel is open, focus is contained. Radix Popover handles this. On open, focus moves to the search input (if rendered) or the active org row. On close (Esc, outside click, selection), focus returns to the trigger.

### Screen-reader announcement on switch

`aria-live="polite"` region (lives in the shell, not the switcher): on successful switch, announce "Organização trocada para {name}". Toast also handles visual confirmation.

---

## 5. Motion

- Panel open: `opacity 0 → 1` + `translateY(-4px) → 0` over `motion-base` with `ease-entry`.
- Panel close: opposite, `ease-exit`.
- Caret rotation: `motion-fast`.
- Switch spinner: standard 1s spin, paused under `prefers-reduced-motion`.

Under `prefers-reduced-motion`: panel just appears (no slide), caret swaps icon without rotation.

---

## 6. Avatar background-color seeding

Eight preset HSL pairs (light/dark mode). For each org, hash `org.id` (any stable hash, e.g. `cyrb53`) modulo 8 to pick.

| Slot | Light bg | Dark bg | Text |
|---|---|---|---|
| 0 | `hsl(239 84% 56%)` | `hsl(234 89% 74%)` | white / slate-900 |
| 1 | `hsl(142 71% 45%)` | `hsl(142 65% 55%)` | white / slate-900 |
| 2 | `hsl(38 92% 50%)`  | `hsl(38 95% 60%)`  | white / slate-900 |
| 3 | `hsl(0 72% 51%)`   | `hsl(0 85% 65%)`   | white / slate-900 |
| 4 | `hsl(280 70% 55%)` | `hsl(280 80% 70%)` | white / slate-900 |
| 5 | `hsl(190 80% 45%)` | `hsl(190 80% 60%)` | white / slate-900 |
| 6 | `hsl(330 75% 55%)` | `hsl(330 80% 70%)` | white / slate-900 |
| 7 | `hsl(60 70% 45%)`  | `hsl(50 90% 60%)`  | slate-900 / slate-900 |

> Same hash → same color always → recognizable across sessions. Future: allow custom uploaded org logo to override.

---

## 7. Error states (in-panel)

If the orgs list refetch fails while the panel is open:

```
┌────────────────────────────────────────────┐
│ Suas organizações                          │
│                                            │
│   ⚠ Não foi possível carregar              │
│      a lista de organizações.              │
│                                            │
│            [ Tentar novamente ]            │
│                                            │
│ ──────────────────────────────────────     │
│  + Criar organização                       │
└────────────────────────────────────────────┘
```

`[ Tentar novamente ]` is a secondary button that calls the query's `refetch()`. The "Criar organização" action stays available — it doesn't depend on the list.

---

## 8. Open judgment calls

- **Search threshold = 8 orgs**: arbitrary; could be 5 or 10. Picked 8 because most starter users will have 1–3 orgs and the search would be noise.
- **Soft reload via `router.refresh()` vs reactive cache invalidation only**: chose `router.refresh()` because Server Components hold authoritative data; an invalidation-only approach risks stale SSR HTML. Trade-off: slightly slower switch (one server round-trip).
- **Role badge label "Dono"**: PT-BR "Dono" is shorter than "Proprietário" and fits the badge. Some teams prefer the formal word — call out to frontend-agent that this is overridable in i18n later.
