# 03 — Create Organization Modal

Spec status: Modal launched from the org switcher (spec 02 §2.5) and from the empty state (spec 01 §7.3).
Depends on: spec 00, spec 02. Endpoint: `POST /api/v1/organizations`.

---

## 1. Visual layout

Modal width `max-w-md` (28rem / 448px), centered. Backdrop covers viewport with `bg-[hsl(var(--overlay)/var(--overlay-alpha))]`. Z-index `z-modal`.

```
┌──────────────────────────────────────────────────────┐
│  Criar organização                              [×]  │  ← header
│  Organize seu time em um espaço compartilhado.       │  ← description
├──────────────────────────────────────────────────────┤
│                                                      │
│  Nome                                                │
│  ┌─────────────────────────────────────────────┐    │
│  │ Acme Brasil                                  │    │
│  └─────────────────────────────────────────────┘    │
│  Aparece para todos os membros.                      │
│                                                      │
│  Identificador (slug)                                │
│  ┌─────────────────────────────────────────────┐    │
│  │ acme-brasil                                  │    │
│  └─────────────────────────────────────────────┘    │
│  Será usado em URLs: app.exemplo.com/org/acme-...    │
│  ✓ Disponível       (or: ⚠ Já em uso)               │
│                                                      │
├──────────────────────────────────────────────────────┤
│                          [ Cancelar ]  [ Criar ]    │  ← footer
└──────────────────────────────────────────────────────┘
```

### Anatomy

- Container: `bg-surface-elevated`, `border border-default`, `rounded-lg`, `shadow-lg`, `p-6`
- Header: `text-xl font-semibold text-primary` (title); `text-sm text-muted` (description below)
- Close button [×]: top-right, icon-only 32x32 button, `aria-label="Fechar"`, secondary ghost variant
- Form section: `flex flex-col gap-4`
- Footer: `flex justify-end gap-2 pt-4 border-t border-default`

---

## 2. Fields

### 2.1 Name (`name`)

| Property | Value |
|---|---|
| Label | "Nome" |
| Helper | "Aparece para todos os membros." |
| Type | text |
| Required | yes |
| Max length | 120 (server-enforced; UI counter shows when ≥ 80 chars used) |
| Min length | 2 (client validation; UX: don't error on first keystroke — debounce 400ms or trigger on blur) |
| Placeholder | "Ex: Acme Brasil" |
| Autofocus | yes (on modal open) |

Validation messages (PT-BR):
- Empty on submit: "Informe um nome para a organização."
- Less than 2 chars: "O nome precisa ter pelo menos 2 caracteres."
- More than 120 chars: "O nome pode ter no máximo 120 caracteres."

### 2.2 Slug (`slug`)

| Property | Value |
|---|---|
| Label | "Identificador (slug)" |
| Helper | "Será usado em URLs: app.exemplo.com/org/{slug}" |
| Type | text |
| Required | yes |
| Max length | 60 |
| Min length | 3 |
| Pattern | `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case: lowercase alphanumerics with single hyphens between segments, no leading/trailing/double hyphens) |
| Placeholder | "Ex: acme-brasil" |

**Auto-suggestion**: when the user types in `name` AND the slug field has not been manually edited, derive the slug client-side:
1. Lowercase
2. Strip diacritics (`'Á'` → `'a'`)
3. Replace any run of non-`[a-z0-9]` with `-`
4. Trim leading/trailing `-`
5. Truncate to 60

Once the user manually edits the slug, stop auto-suggesting (track `slugTouched` state).

**Uniqueness preview**: debounce 400ms after each slug change. If the slug is valid (matches pattern), call a lightweight check. Options:
- (a) `HEAD /api/v1/organizations?slug=X` if the backend exposes it.
- (b) Otherwise: skip the preview and rely on the 422 from `POST`.

Spec recommendation: **start with (b) — no preview endpoint**. The "disponível" indicator is omitted in v1; instead, the modal handles the 422 conflict gracefully (see §4). Frontend-agent should note this and call out if backend later adds a check endpoint. *(This is a judgment call — document it.)*

Validation messages (PT-BR):
- Empty on submit: "Informe um identificador."
- Bad pattern: "Use apenas letras minúsculas, números e hífens (sem espaços)."
- Less than 3 chars: "O identificador precisa ter pelo menos 3 caracteres."
- More than 60 chars: "O identificador pode ter no máximo 60 caracteres."
- Conflict from server (422): "Este identificador já está em uso. Tente outro."

### Input states (apply to both fields)

| State | Visual |
|---|---|
| Default | `border-default`, `bg-surface`, `text-primary`, `placeholder:text-disabled` |
| Hover   | `border-strong` |
| Focus-visible | `outline-none ring-2 ring-accent ring-offset-2 ring-offset-surface-elevated`, `border-transparent` |
| Invalid (touched + has error) | `border-danger`, helper text replaced by error text in `text-danger` (`text-sm`), `aria-invalid="true"`, `aria-describedby={errorId}` |
| Disabled | `opacity-50 bg-surface-sunken cursor-not-allowed` |
| Loading (during submit) | All inputs disabled |

---

## 3. Buttons (footer)

### Cancelar
- Variant: secondary (ghost): `bg-transparent text-primary border border-default hover:bg-surface-sunken`
- Behavior: close modal without saving
- Always enabled (even during submit — cancellation aborts the request)

### Criar
- Variant: primary accent: `bg-accent text-accent-foreground hover:bg-accent-hover`
- States:
  | State | Visual / behavior |
  |---|---|
  | Default | enabled when form is valid AND dirty |
  | Disabled | `opacity-50 cursor-not-allowed` — when form invalid, untouched, or already submitting |
  | Loading | shows spinner left of label, label changes to "Criando...", `aria-busy="true"` |
  | Hover (enabled) | `bg-accent-hover` |
  | Focus-visible | focus ring |
  | Success | (no in-modal success state — modal closes on success; toast handles it) |

---

## 4. Submit flow

```
1. User clicks "Criar" or presses Enter in any field.
2. Client validates with Zod (see spec 05). If invalid, set field errors, no request.
3. Disable form, show "Criando..." on submit button.
4. POST /api/v1/organizations  body: { name, slug }
5a. 201 → new Org returned
    - queryClient.invalidateQueries(['me'])  AND  invalidate(['organizations'])
    - localStorage.setItem('currentOrganizationId', newOrg.id)
    - toast({ title: 'Organização criada', variant: 'success' })
    - close modal
    - router.push('/dashboard')  (or /org/[slug]/dashboard once that route exists)
    - router.refresh() so the shell rehydrates with the new active org
5b. 422 with errors.slug → highlight slug field with conflict message (§2.2)
5c. 422 with errors.name → highlight name field
5d. 403 (rate-limited or policy) → toast destructive with the server's PT-BR message via parseApiError (spec 05 §4)
5e. Network error → toast destructive "Falha de rede. Verifique sua conexão e tente novamente.", re-enable form
6. On any error path: focus returns to the first invalid field (or to name if none specific).
```

---

## 5. Accessibility

- Built on Radix Dialog. Use `<Dialog>`, `<DialogTrigger>` (triggered programmatically from outside), `<DialogPortal>`, `<DialogOverlay>`, `<DialogContent>`, `<DialogTitle>`, `<DialogDescription>`.
- `DialogContent` props:
  - `aria-labelledby="create-org-title"`
  - `aria-describedby="create-org-desc"`
  - `onOpenAutoFocus={(e) => { e.preventDefault(); nameInputRef.current?.focus(); }}`
  - `onCloseAutoFocus={(e) => { e.preventDefault(); switcherTriggerRef.current?.focus(); }}`
- Focus trap: handled by Radix Dialog.
- `Esc` closes the modal (Radix default). Confirm-on-close if any field is dirty? **No** for v1 — content is short, low risk of data loss. Document as overridable.
- Backdrop click closes modal (Radix default).
- Each field has:
  - `<label htmlFor={id}>` with the visible label
  - `aria-describedby` pointing to helper text id OR error text id (helper while clean, error after touch+invalid)
  - `aria-required="true"` on both
  - `aria-invalid={hasError}`
- Submit button: `aria-busy={isPending}` while loading.
- Live region for submit errors that aren't field-bound: `<div role="alert" aria-live="assertive">` inside modal body.
- All copy in PT-BR; no English in the rendered modal.

---

## 6. Motion

Same as spec 02 (entry/exit):
- Overlay: `opacity 0 → 1`, `motion-base`, `ease-standard`.
- Content: `opacity 0 → 1` + `scale(0.96 → 1)`, `motion-base`, `ease-entry`. Exit reverses with `ease-exit`.
- Under `prefers-reduced-motion`: skip scale and translate, only opacity changes; duration → `1ms`.

---

## 7. Mobile

On `< sm` (640px), modal becomes a bottom sheet:
- Full width, `rounded-t-lg` only (no bottom radius), pinned to bottom, max-h `90vh`, scrollable body.
- Drag handle (a 36×4 px pill, `bg-border-default`, centered, 8px top margin) replaces the close X (which remains in the header for redundancy).
- Animation: slide-up `translateY(100%) → 0` over `motion-base`.
- Footer buttons stack: `Criar` on top (full width), `Cancelar` below (full width, secondary).

```
┌──────────────────────────────────────────────────────┐
│                       ──                             │  ← drag handle
│  Criar organização                              [×]  │
│  Organize seu time em um espaço compartilhado.       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Nome                                                │
│  [ Acme Brasil                                  ]    │
│                                                      │
│  Identificador (slug)                                │
│  [ acme-brasil                                  ]    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [          Criar (primary, full width)          ]   │
│  [        Cancelar (secondary, full width)        ]  │
└──────────────────────────────────────────────────────┘
```

---

## 8. Open judgment calls

- **No slug uniqueness preview in v1** — relies on the 422 from POST. Trade-off: slightly worse UX (user discovers conflict after clicking Criar) vs no new endpoint. Frontend-agent should leave a `// TODO: when /api/v1/organizations/check-slug exists, add live preview` comment.
- **No "confirm leave with unsaved changes" prompt** — modal is short; over-friction. Leaves data behind on close, intentional.
- **Auto-derive slug only until user touches it** — alternative is to always derive. Chose touched-flag because some teams want a different slug (e.g. `acme-br` for `Acme Brasil`).
- **Redirect target post-create**: `/dashboard` is safest (always exists). Spec 04 places org settings at `/org/[slug]/settings`; we could redirect there instead to encourage onboarding. Recommendation: `/dashboard` for v1, mention as TODO.
