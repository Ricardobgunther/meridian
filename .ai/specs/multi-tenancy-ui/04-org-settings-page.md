# 04 — Organization Settings Page

Spec status: Page-level. Combines Geral + Membros tabs and the danger zone.
Depends on: spec 00 (tokens), spec 01 (shell), spec 05 (state), spec 06 (a11y).

---

## 1. Route

**Recommendation: `/org/[slug]/settings`** with sub-tabs as query string OR child routes.

Why slug, not id:
- URLs are human-readable and shareable across team members.
- Slug is stable from the user's perspective; switching slugs is rare and destructive (and we already guard it).
- Pattern matches Linear, GitHub, Vercel.

Why under `/org/[slug]/` instead of a flat `/settings/org`:
- The starter will eventually have `/org/[slug]/members`, `/org/[slug]/dashboard`, etc. Co-locating settings under the same prefix keeps the URL space coherent.
- The slug in the URL gives backend-agent a fallback when the `X-Organization-Id` header is missing (defense in depth; primary source remains the header per ADR-009).

Sub-tabs:
- Default: Geral → `/org/[slug]/settings` (or `?tab=general`)
- Membros → `/org/[slug]/settings/members` (or `?tab=members`)

**Implementation pick: child routes** (Next.js App Router segments). Cleaner code, native breadcrumbs, no `useSearchParams` churn. Layout file `/org/[slug]/settings/layout.tsx` renders the tab bar; child segments render content. *(Judgment call — frontend-agent may pick query strings if implementation is faster; both work.)*

---

## 2. Page chrome

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Configurações                                                          │
│  Gerencie sua organização e seus membros.                                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ◉ Geral        ○ Membros                                          │   │  ← tab bar
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  {tab content}                                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- Title `text-2xl font-bold text-primary`.
- Subtitle `text-sm text-muted`.
- Tab bar: Radix Tabs. Visual: horizontal list, each tab `px-3 py-2 text-sm font-medium`, bottom 2px indicator under active. Inactive `text-muted`, active `text-primary border-b-2 border-accent`. Hover bumps bg to `surface-elevated`.
- Mobile: tabs scroll horizontally if needed; never stack vertically.

---

## 3. Tab: Geral

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Informações                                                             │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Nome                                                                    │
│  ┌─────────────────────────────────────────────┐                         │
│  │ Acme Brasil                                  │                         │
│  └─────────────────────────────────────────────┘                         │
│                                                                          │
│  Identificador (slug)                                                    │
│  ┌─────────────────────────────────────────────┐                         │
│  │ acme-brasil                                  │                         │
│  └─────────────────────────────────────────────┘                         │
│  ⚠ Trocar o identificador altera todas as URLs da organização.           │
│                                                                          │
│                                       [ Cancelar ]  [ Salvar alterações ]│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  Zona de perigo                                                          │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Excluir organização                                                     │
│  Esta ação não pode ser desfeita. Todos os membros perderão acesso.      │
│                                                                          │
│                                                  [ Excluir organização ] │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Section: Informações

Card: `bg-surface-elevated border border-default rounded-lg p-6 flex flex-col gap-4`.
Section header: `text-lg font-semibold text-primary`. Optional `text-sm text-muted` subtitle.

Fields:

#### Nome
- Same shape as create-org modal name (spec 03 §2.1).
- Editable only if `your_role` is `owner` or `admin`. Otherwise input is `readonly`, `disabled` styling, and a `text-sm text-muted` line below says "Apenas administradores podem editar."

#### Slug
- Same shape as create-org modal slug (spec 03 §2.2).
- Editable only by `owner`. (Admins can edit name but not slug — slug change is structurally destructive: URL changes, bookmarks break.)
- Warning helper text (always present when editable): "⚠ Trocar o identificador altera todas as URLs da organização."
- On Save, if the slug changed, a **confirmation dialog** appears before the PATCH:

  ```
  ┌──────────────────────────────────────────┐
  │ Trocar o identificador?                  │
  │                                          │
  │ A organização "acme-brasil" passará a    │
  │ ser acessada em "acme-br-2026". Links    │
  │ antigos pararão de funcionar.            │
  │                                          │
  │            [ Cancelar ]   [ Confirmar ]  │  ← Confirmar = danger variant
  └──────────────────────────────────────────┘
  ```

### Save / Cancel

- Cancel: resets form to last-fetched values.
- Salvar: PATCH `/api/v1/organizations/{id}`. Disabled when form is clean or invalid. Loading shows spinner + "Salvando...". Success → toast "Alterações salvas." + invalidate `['organization', orgId]` and `['organizations']`. If slug changed, also `router.replace('/org/{newSlug}/settings')`.

### States summary

| State | Visual |
|---|---|
| Loading (initial fetch) | Skeleton: title + 2 input blocks |
| Error (fetch failed) | Inline error banner with retry CTA (`bg-danger-soft border-danger`) |
| Success | Form rendered, fields editable per role |
| Saving | Form locked, submit btn `aria-busy="true"` |
| Save error | Toast + field error if 422 |
| Permission denied (member viewing) | All fields `readonly`, banner: "Você está visualizando como membro. Algumas opções não estão disponíveis." |

### Section: Zona de perigo

Visible only to `owner`. Hidden (not rendered) for admin and member.

Card: same chrome as Informações but `border-danger/40` and section title `text-danger`.

#### Excluir organização

Description: "Esta ação não pode ser desfeita. Todos os membros perderão acesso."

Button: variant danger (`bg-danger text-white hover:bg-danger/90`). Opens confirmation dialog:

```
┌─────────────────────────────────────────────────────────┐
│ Excluir organização                                [×]  │
│ Esta ação não pode ser desfeita.                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Para confirmar, digite o nome da organização abaixo:   │
│                                                         │
│  Acme Brasil                                            │  ← shown for reference, copyable text
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │                                              │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                          [ Cancelar ]  [ Excluir ]      │  ← Excluir = danger, disabled until match
└─────────────────────────────────────────────────────────┘
```

- The "Excluir" button is disabled until typed text exactly matches the org name (case-sensitive).
- On confirm: DELETE `/api/v1/organizations/{id}`. Success → toast "Organização excluída", `localStorage.removeItem('currentOrganizationId')`, redirect to `/dashboard` (which triggers the empty state if there are no other orgs, or auto-selects the next one).
- Error (403): toast "Você não tem permissão para excluir esta organização." (parseApiError handles).

---

## 4. Tab: Membros

### Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Membros (24)                                                            │
│                                                                          │
│  ┌────────────────────────────┐ ┌──────────────┐  [ + Convidar membro ] │
│  │ 🔍 Buscar nome ou e-mail   │ │ Função: Todas ▾│                       │
│  └────────────────────────────┘ └──────────────┘                         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [JS]  Joana Silva                Dono       Há 6 meses     · · · │   │
│  │       joana@acme.com                                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ [PA]  Pedro Alves                Admin ▾    Há 4 meses     · · · │   │
│  │       pedro@acme.com                                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ [MN]  Maria Nunes                Membro ▾   Há 2 meses     · · · │   │
│  │       maria@acme.com                                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                            ‹ 1  2  3 ›                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Toolbar (above list)

- Search input: `text-sm`, search icon left, placeholder "Buscar nome ou e-mail". Debounced 300ms. Filters via `?q=` query param on `GET /api/v1/organizations/{id}/members`.
- Role filter: select with options "Todas / Donos / Admins / Membros". Filters via `?role=` query param. Default "Todas".
- "Convidar membro" button: variant accent, right-aligned. Only visible to `admin` and `owner`. Opens an invite modal — **not in scope for this spec** (separate spec when backend has invite endpoint with email). For v1, the button can be hidden OR open a placeholder modal that says "Em breve". Spec recommends hide for v1 to avoid dead UI. *(Judgment call.)*

### List row

Card: `border border-default rounded-md`, list of rows separated by `divide-y divide-default`. Row padding `px-4 py-3`. `flex items-center gap-4`.

| Part | Spec |
|---|---|
| Avatar (40px) | Initials or photo if `user.avatar_url`. Same hashing scheme as org switcher (spec 02 §6) but seeded by `user.id`. |
| Name + email | Stack. Name `text-sm font-medium text-primary`. Email `text-xs text-muted truncate`. |
| Role | If row is editable (see §4.3): dropdown trigger showing `Dono ▾`. If not: plain text badge same as switcher rows (spec 02 §2.3). |
| Joined-at | `text-xs text-muted tabular-nums`. Format: "Há 6 meses" using `Intl.RelativeTimeFormat('pt-BR')`. Tooltip on hover shows full date. |
| Actions menu (`···`) | Icon button → dropdown with "Remover do time" (danger variant). Hidden when no action is available to the viewer. |

#### Row states

| State | Visual |
|---|---|
| Default | Surface-elevated bg |
| Hover   | Slight bg shift (`bg-surface-sunken`) |
| Focus-within | Focus ring on whichever element is focused |
| Updating (role change or remove in flight) | Row gets `opacity-70` + small inline spinner on the role/actions column, `aria-busy="true"` |
| Removed (optimistically) | Row fades out over `motion-base` then unmounts |

### 4.3 Role-change rules (must be enforced both in UI and backend)

Let `viewer = your_role` and `target = member.role`.

Role dropdown for a given row is **enabled** when ALL of these are true:
1. `viewer` is `owner` or `admin`.
2. `target` does not outrank `viewer`. (`owner > admin > member`.)
3. Row is not the viewer themselves (you can't change your own role).
4. If `target === 'owner'` AND the org has exactly one owner: cannot downgrade. Tooltip on hover: "Não é possível rebaixar o único proprietário."

When disabled, dropdown trigger shows the role as text with a small lock icon and a tooltip explaining why.

Dropdown options (admin viewer can offer: member, admin; owner viewer can offer: member, admin, owner). On selection: PATCH `/api/v1/organizations/{id}/members/{member}` with `{role: newRole}`. Optimistic update (rollback on error). Toast on success: "Função atualizada."

Promoting someone to `owner`: shows a confirmation dialog first ("Promover {name} a Dono dará a essa pessoa controle total da organização. Continuar?") because it's effectively granting destructive permission.

### 4.4 Remove member rules

Action item "Remover do time" is enabled when:
1. `viewer` is `owner` or `admin`.
2. `target` does not outrank `viewer`.
3. Row is not the viewer themselves. (To leave the org, viewer uses a dedicated "Sair da organização" action — out of scope for this spec; mention as TODO.)
4. NOT (`target === 'owner'` AND only one owner remains).

Confirmation dialog:

```
┌──────────────────────────────────────────────────────┐
│ Remover Pedro Alves?                                 │
│                                                      │
│ Pedro perderá acesso a Acme Brasil imediatamente.    │
│                                                      │
│                  [ Cancelar ]   [ Remover ]          │  ← Remover = danger
└──────────────────────────────────────────────────────┘
```

On confirm: DELETE `/api/v1/organizations/{id}/members/{member}`. Optimistic remove. On error, restore row and toast.

### 4.5 Pagination

Server returns `meta.current_page`, `meta.last_page`, `meta.per_page`, `meta.total`. Numeric pagination at the bottom: `‹ 1 2 3 ›`. Default `per_page = 20`. URL reflects state: `?page=2`.

If `total === 0`, render empty state (§4.6) instead of list+pagination.

### 4.6 Empty / loading / error states (members)

#### Loading
Skeleton: 5 rows with skeleton avatar + skeleton lines.

#### Error
```
┌──────────────────────────────────────────────────────┐
│              [icon: cloud-off, 40px, text-muted]      │
│                                                       │
│       Não foi possível carregar os membros.           │
│                                                       │
│                 [ Tentar novamente ]                  │
└──────────────────────────────────────────────────────┘
```

#### Empty (filtered: search/role returned nothing)
```
┌──────────────────────────────────────────────────────┐
│             [icon: search, 40px, text-muted]          │
│                                                       │
│       Nenhum membro corresponde aos filtros.          │
│                                                       │
│              [ Limpar filtros ]                       │
└──────────────────────────────────────────────────────┘
```

#### Empty (org has zero members — only the viewer)
This is a weird edge case (every org has at least its owner). If it happens:
```
┌──────────────────────────────────────────────────────┐
│              [icon: users, 40px, text-muted]          │
│                                                       │
│       Você é o único membro desta organização.        │
│                                                       │
│           [ + Convidar membro ]                       │  ← only if invite is implemented
└──────────────────────────────────────────────────────┘
```

---

## 5. Accessibility

- Tabs: `Tab` to enter, `←/→` to switch between tabs, `Enter`/`Space` activates (Radix default).
- All confirmation dialogs use the same Dialog primitive as spec 03; focus trap, `Esc` to close, focus return to trigger.
- The "type the org name to confirm" pattern: input has `aria-label="Digite o nome da organização para confirmar"`, helper text linked by `aria-describedby`.
- Role dropdown trigger has `aria-label="Função de {name}: {currentRole}. Clique para alterar."`.
- The actions menu trigger (`···`) has `aria-label="Mais ações para {name}"`.
- Member rows: each row is a list item (`<ul role="list">` parent, `<li>` rows). Avatar `aria-hidden="true"` because the name+email already provide identity.
- Status announcements (`aria-live="polite"`) for role changes and removals: "Função de {name} alterada para {role}." / "{name} removido da organização."

---

## 6. Permissions matrix summary

| Action | Owner | Admin | Member |
|---|---|---|---|
| View Geral tab | yes | yes | yes (readonly) |
| Edit name | yes | yes | no |
| Edit slug | yes | no  | no |
| Delete org | yes | no  | no |
| View Membros tab | yes | yes | yes (readonly) |
| Search/filter | yes | yes | yes |
| Change member roles | yes (incl. promote to owner) | yes (cannot create/demote owners) | no |
| Remove members | yes (cannot remove last owner) | yes (cannot remove owners) | no |
| Invite (when added) | yes | yes | no |

The UI must enforce all of these — but backend is the authority (defense in depth).

---

## 7. Mobile mockup (members list)

```
┌──────────────────────────────────────┐
│ Configurações                       │
│ ─────────────────────────────────── │
│ ◉ Geral    ○ Membros                │
│                                      │
│ Membros (24)                         │
│                                      │
│ [🔍 Buscar...                    ]  │
│ [Função: Todas ▾                 ]  │
│                                      │
│ ┌──────────────────────────────────┐│
│ │ [JS] Joana Silva              ···││
│ │      joana@acme.com              ││
│ │      Dono · há 6 meses           ││
│ ├──────────────────────────────────┤│
│ │ [PA] Pedro Alves              ···││
│ │      pedro@acme.com              ││
│ │      Admin · há 4 meses          ││
│ └──────────────────────────────────┘│
│                                      │
│        ‹  1  2  3  ›                │
└──────────────────────────────────────┘
```

On mobile, the role dropdown opens inside the `···` actions menu instead of inline, to save horizontal space.

---

## 8. Open judgment calls

- **Settings under `/org/[slug]/settings` vs `/settings/org`**: chose `/org/[slug]/...` for consistency with future org-scoped routes. The alternative groups all "settings" pages under one prefix — also defensible.
- **Child routes vs query-string tabs**: chose child routes; query-string is fine if frontend-agent finds it faster.
- **Hide invite button vs show "em breve"**: hide for v1. Avoids dead UI; less to test.
- **Slug change confirmation dialog**: required by this spec because slug changes break links. Some tools (Slack) just warn inline — we picked a dialog for safety.
- **Inline role dropdown vs in-`···`-menu**: desktop shows inline (better discoverability), mobile shows in menu (space). Acceptable; frontend-agent can pick to mirror everywhere if simpler.
