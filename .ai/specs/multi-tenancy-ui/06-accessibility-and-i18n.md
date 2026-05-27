# 06 — Accessibility & i18n (cross-cutting)

Spec status: Mandatory contract for every component in this UI pack. WCAG 2.1 AA is non-negotiable.
References: WCAG 2.1 AA, WAI-ARIA Authoring Practices 1.2.

---

## 1. Color contrast — verified

All token combinations in spec 00 §1 pass WCAG 2.1 AA for both light and dark mode. Spec 00 documents the ratios. Re-check whenever a token's HSL changes.

Specific check points the frontend-agent must NOT break:
- Buttons: `accent-foreground` on `accent` ≥ 4.5:1.
- Form labels: `text-primary` on `surface-elevated` ≥ 7:1.
- Helper / muted text: `text-muted` on `surface` and on `surface-elevated` ≥ 4.5:1.
- Disabled text: `text-disabled` on `surface` is allowed to be 3:1 (large text only). Don't put critical content in disabled color.
- Status pills: each role/feedback combo (`success` on `success-soft`, `danger` on `danger-soft`, etc.) ≥ 4.5:1 — verified in spec 00.

Tooling: add `@axe-core/playwright` to e2e tests (testing-agent's domain, but flag it here).

---

## 2. Keyboard navigation

All interactive elements:
- Must be reachable via `Tab` / `Shift+Tab` in DOM order.
- Must have a visible focus indicator (focus ring token, spec 00 §8). **Never** `outline-none` without a substitute.
- Must be operable with `Enter` / `Space` (where the role applies — buttons, links, custom widgets).

Custom widgets in this spec pack and their required key maps:

| Widget | Spec | Keys |
|---|---|---|
| Org switcher trigger + listbox | 02 | `Tab`, `↓/↑`, `Home/End`, `Enter/Space`, `Esc`, typeahead |
| Create-org modal | 03 | `Tab` (trap), `Esc`, `Enter` to submit |
| Confirm dialogs (delete, role-promote, slug change, remove member) | 04 | Same as modal |
| Tabs (Geral / Membros) | 04 | `Tab` to enter, `←/→` between tabs, `Enter/Space` activates |
| Sidebar (drawer & persistent) | 01 | `Tab` through items, `Esc` closes drawer |
| User menu | 01 | `Tab` to open, `↓/↑` through items, `Enter` activates, `Esc` closes |
| Role dropdown per member | 04 | `Enter/Space` opens, `↓/↑` through options, `Enter` selects, `Esc` closes |
| Actions menu (`···`) per member | 04 | Same as role dropdown |

Skip-link is the first focusable element in the page (`Pular para o conteúdo` → `#main-content`), visually hidden until focused.

---

## 3. Screen reader contract

### Required attributes

- Every icon-only button has an `aria-label` in PT-BR. Reference list:
  - Collapse sidebar: `aria-label="Recolher menu lateral"` / `Expandir menu lateral`
  - Open mobile drawer: `aria-label="Abrir menu"`
  - Close drawer/modal: `aria-label="Fechar"`
  - User menu trigger: `aria-label="Abrir menu da conta"`
  - Org switcher trigger: `aria-label="Trocar organização. Atual: {orgName}."`
  - Search (when disabled): `aria-label="Pesquisar (em breve)"` and `aria-disabled="true"`
  - Member row actions menu: `aria-label="Mais ações para {memberName}"`
  - Role dropdown: `aria-label="Função de {memberName}: {currentRole}. Clique para alterar."`

- Decorative icons (e.g. avatar initials, caret on dropdowns): `aria-hidden="true"`.

- Toasts: success/info → `role="status"`, `aria-live="polite"`. Errors → `role="alert"`, `aria-live="assertive"`. (Sonner handles this; if rolling custom, do not forget.)

- Loading states: `aria-busy="true"` on the affected region. Spinner itself `aria-hidden="true"` (the busy attribute carries the meaning).

- Form validation:
  - `aria-required="true"` on required inputs.
  - `aria-invalid={hasError}`.
  - `aria-describedby={helperId | errorId}` — helper when valid, error when invalid.
  - Error text inline below input, `role="alert"` so SR announces immediately when it appears.

### Live regions (in `<Shell>`)

- `<div aria-live="polite" aria-atomic="true" className="sr-only" id="shell-live">` — used for non-urgent announcements (org switched, role updated, member removed).
- `<div aria-live="assertive" aria-atomic="true" className="sr-only" id="shell-alert">` — reserved for urgent error states (session expired, etc.).

Wrappers: `announce(text: string)` and `announceAlert(text: string)` helpers in `lib/a11y/announce.ts`.

### Heading hierarchy

- `<h1>` = page title (one per page). Example: "Configurações" on settings page.
- `<h2>` = section titles within a page. Example: "Informações", "Zona de perigo", "Membros (24)".
- `<h3>` = subsections (rare in this spec pack).
- Modals: `DialogTitle` becomes the `<h2>` inside the dialog's flow but uses `aria-labelledby` not a literal h-tag (Radix handles this).

Never skip levels (h1 → h3 without h2). Never use a heading purely for visual weight — use Tailwind classes for that.

---

## 4. Focus management — the rules

### On modal open

- Default focus = first focusable inside the modal that's NOT the close button.
  - Create-org modal → `name` input.
  - Confirm dialogs → Cancelar button (safest default; user must consciously move to the destructive action).
  - Confirm-delete-org typed-name dialog → the typed-name input.

### On modal close

- Focus returns to the element that opened it (the trigger).
- Radix Dialog handles this via `onCloseAutoFocus`; we set `preventDefault()` only when we want a custom return target.

### On route change (within shell)

- After `router.push()`, focus the `<main id="main-content" tabIndex={-1}>` element. Add a `useEffect` in the page-level layout that runs on `pathname` change.

### On switcher org change

- Switcher panel closes → focus returns to switcher trigger.
- Announcement region (`#shell-live`) gets "Organização trocada para {name}".

### On error retry CTA click

- Focus stays on the button (no jump). Once retry resolves successfully, focus moves to first heading of the now-rendered content.

---

## 5. Reduced motion

`@media (prefers-reduced-motion: reduce)`:

- All non-essential transitions become `1ms` (effectively instant).
- The skeleton pulse animation (`animate-pulse`) stops; replace with a static slightly-tinted block.
- Modal/drawer entry: opacity-only, no scale or translate.
- Caret rotation on dropdown open: swap icon source instead of rotating.
- Loading spinners can keep spinning (they are essential to communicate progress) but should be 1.5s/rotation (not faster).

Tailwind: use the `motion-reduce:` variant. Example:
```
className="transition-all duration-base motion-reduce:transition-none motion-reduce:transform-none"
```

Globally: also add a CSS rule that respects the system preference even on third-party libs:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 6. Touch targets

- Minimum 40×40 px on touch devices (`< lg`). All buttons in topbar, modal close, role dropdown trigger, actions menu trigger, mobile drawer items.
- Spacing between adjacent targets ≥ 8px.

---

## 7. RTL readiness

We don't render RTL today (PT-BR is LTR), but avoid baking direction:
- Use `start/end` Tailwind utilities (`ms-2`, `me-2`, `text-start`) where possible.
- Avoid hardcoded `left-0` for positioned elements that could flip (dropdowns).
- Mark this as a known TODO — fully RTL audit when an Arabic/Hebrew locale is added.

---

## 8. i18n — strategy without implementing

PT-BR is the default and only locale for this round. To keep future translation cheap:

### Conventions

1. **No literals scattered in JSX**. Every user-facing string lives in a single dictionary module per scope:
   ```
   lib/i18n/dict/pt-BR/
     auth.ts
     shell.ts
     orgs.ts
     members.ts
     settings.ts
     errors.ts
   ```
   Each file exports a flat object `{ key: 'text in PT-BR' }`.

2. **Component accesses strings through a tiny helper**:
   ```ts
   // lib/i18n/t.ts (v1 = synchronous, no locale switching)
   import { shell, orgs, members /* ... */ } from './dict/pt-BR';
   export const t = { shell, orgs, members } as const;

   // Usage
   <button>{t.shell.userMenu.logout /* "Sair" */}</button>
   ```

3. **Pluralization**: a small `plural(n, { one, other })` helper. Avoid hardcoded "1 membro" / "2 membros" branches inline.

4. **Date / number formatting**: always via `Intl.RelativeTimeFormat('pt-BR')`, `Intl.DateTimeFormat('pt-BR')`, `Intl.NumberFormat('pt-BR')`. No string templating like `` `${day}/${month}` ``.

5. **Server error messages**: backend returns PT-BR; parseApiError (spec 05 §4) passes them through. Future i18n will need a key-based mapping, but punting for now.

### What we explicitly DO NOT do in this round

- next-intl, react-intl, lingui, or any heavy lib.
- Locale switcher in the UI.
- Right-to-left.
- Currency / region settings per user.

When a second locale is added, the dictionary modules become a server-resolved Map indexed by `user.locale` (already on `User`). Backend's role-based messages will get a translation table at that time.

---

## 9. Specific PT-BR copy that must be exact

These strings are referenced across multiple specs; consolidate here so they don't drift.

### Empty states
- No orgs: "Bem-vindo(a) ao [Nome do produto]" / "Para começar, crie sua primeira organização ou aguarde um convite de um administrador."
- Filtered list returns 0: "Nenhum membro corresponde aos filtros."
- Org has only viewer: "Você é o único membro desta organização."

### Errors (UI-safe phrasings)
- Network: "Verifique sua internet e tente novamente."
- Session expired: "Sua sessão expirou. Faça login novamente."
- 403: usually backend's PT-BR message wins; fallback "Você não tem permissão para esta ação."
- 5xx: "Algo deu errado do nosso lado. Tente novamente em instantes."
- 429: "Aguarde alguns instantes e tente novamente."

### Confirmations
- Generic destructive: "Esta ação não pode ser desfeita."
- Delete org: "Todos os membros perderão acesso imediatamente."
- Remove member: "{name} perderá acesso a {orgName} imediatamente."
- Promote to owner: "Promover {name} a Dono dará a essa pessoa controle total da organização. Continuar?"
- Slug change: "A organização \"{oldSlug}\" passará a ser acessada em \"{newSlug}\". Links antigos pararão de funcionar."

### Buttons
- Save: "Salvar alterações"
- Cancel: "Cancelar"
- Confirm destructive: "Excluir" / "Remover" (verb matches action; never the generic "Confirmar")
- Try again: "Tentar novamente"
- Create org: "Criar organização" / "+ Criar organização"
- Switch org: trigger doesn't have a button label (`aria-label` only)

### Role labels (UI display)
- `owner` → display: "Dono", formal: "Proprietário" (tooltip)
- `admin` → display: "Admin", formal: "Administrador" (tooltip)
- `member` → display: "Membro" (no tooltip needed)

### Status / success
- Org created: "Organização criada"
- Org updated: "Alterações salvas"
- Org deleted: "Organização excluída"
- Member added (future): "Membro adicionado"
- Member removed: "{name} removido da organização"
- Role updated: "Função atualizada"
- Org switched: "Organização trocada para {name}" (live region announcement, not toast)

---

## 10. Testing acceptance criteria (handoff hint to testing-agent)

For each major component in this pack, the testing-agent should verify:

1. Keyboard-only flow completes the primary action (no mouse).
2. Screen-reader (NVDA on Windows, VoiceOver on Mac) announces:
   - Page title on navigation.
   - Modal title on open.
   - Live region updates on async actions.
3. Color contrast verified via axe in both themes.
4. Reduced motion: animations stop being noticeable.
5. Focus visible on every focusable element (no `outline: none` slips).
6. No `aria-label` is missing on icon-only buttons.

---

## 11. Open judgment calls

- **PT-BR "Dono" vs "Proprietário"**: chose "Dono" for badge brevity. Tooltips carry the formal word. Either is acceptable — confirm with stakeholders before locking in.
- **Dictionary-based i18n vs literal-strings-in-JSX**: chose dictionary. Slightly more boilerplate now, but lock-in cost is near-zero once second locale comes.
- **Skip-link target = `<main>` vs page heading**: chose `<main>` because Next.js renders the same main per route; the heading sometimes doesn't exist (loading state). Main is always there.
- **Live region pattern**: spec uses `aria-live="polite"` for most events. Some teams prefer `assertive` for "org switched" because it's a major context change. Picked polite to avoid SR interruption.
