# 02 — Invite Modal

Spec status: Component-level. Modal disparado pelo botão "Convidar membro" no header da seção Membros.
Depends on: `multi-tenancy-ui/00-design-tokens.md`, `multi-tenancy-ui/03-create-org-modal.md` (shared Dialog primitive), `multi-tenancy-ui/05-state-and-data-flow.md`, `multi-tenancy-ui/06-accessibility-and-i18n.md`.

> Reuse the same Dialog primitive, sizing, and motion as the Create Organization modal. This spec only details what's different.

---

## 1. Trigger

- Button "Convidar membro" in the Members section header (spec 01 §6).
- Visible only to `owner` and `admin`. Fully hidden for `member`.
- Click → opens the modal via `useUiStore.openModal({ kind: 'invite-member' })`. (Add `invite-member` to the `activeModal` union in the UI store.)

---

## 2. Modal frame

```
┌──────────────────────────────────────────────────────────────┐
│ Convidar membro                                          [×] │
│ Envie um convite por email para alguém entrar na sua         │
│ organização.                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Email                                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ bruno@acme.com                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  Enviaremos um convite com link para essa pessoa.            │
│                                                              │
│  Função                                                      │
│  ┌─────────────────────────────┐ ┌─────────────────────────┐│
│  │ ◉  Membro                   │ │ ○  Administrador         ││
│  │    Acesso padrão ao workspace│ │    Pode gerenciar membros││
│  └─────────────────────────────┘ └─────────────────────────┘│
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                            [ Cancelar ]   [ Enviar convite ] │
└──────────────────────────────────────────────────────────────┘
```

- Width: `max-w-md` (480px) on desktop, full-width minus `px-4` on mobile.
- Padding: `p-6` body, `px-6 py-4` header and footer (consistent with Create Org modal).
- Border between header/body and body/footer: `border-b border-default` on header, `border-t border-default` on footer.
- Backdrop: `bg-[hsl(var(--overlay)/var(--overlay-alpha))]`. Click outside closes (matches Create Org behavior).
- Close button (`×`): top-right, `aria-label="Fechar"`, 32×32 hit area.

### Title and description

- Title `text-lg font-semibold text-primary` — "Convidar membro".
- Description `text-sm text-muted` — "Envie um convite por email para alguém entrar na sua organização."
- Both wired to `aria-labelledby` / `aria-describedby` per Radix Dialog convention.

---

## 3. Fields

### 3.1 Email

- Label "Email" — `text-sm font-medium text-primary`.
- Input: `type="email"`, `autoFocus`, `autoComplete="email"`, `inputMode="email"`, `spellCheck={false}`.
- Placeholder: `t.invitations.modal.emailPlaceholder` — "exemplo@empresa.com" (deliberately generic — never use a real-looking employee email as a placeholder, that's a phishing-training anti-pattern).
- Helper text below: "Enviaremos um convite com link para essa pessoa." (`text-xs text-muted`, `id="invite-email-helper"`, linked via `aria-describedby`).
- States: default, focus, error, disabled — same recipe as Create Org name field (spec 03 §2.1).

#### Validation

Inline, on blur AND on submit. Display below the input as `role="alert" text-xs text-danger` (replaces the helper text via `aria-describedby` swap).

| Trigger | Message (PT-BR) | Key |
|---|---|---|
| Empty | "Informe um email." | `emailRequired` |
| Invalid format | "Email inválido." | `emailInvalid` |
| Local checks pass + backend says 409 already-member | "Esta pessoa já é membro desta organização." | `emailAlreadyMember` |
| Local checks pass + backend says 409 already-pending | "Já existe um convite pendente para este email." | `emailAlreadyPending` |

Local format check: a simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Backend is the authority for the two 409 cases.

### 3.2 Role

A Radix RadioGroup styled as a segmented option group. Two cards side-by-side (md+) or stacked (mobile).

| Card | Value | Title | Subtitle |
|---|---|---|---|
| 1 | `member` | "Membro" | "Acesso padrão ao workspace." |
| 2 | `admin` | "Administrador" | "Pode gerenciar membros e configurações." |

**Default selected: `member`** — safer default, matches J in 00-overview §7.2.

#### Card visual

```
┌─────────────────────────────────────┐
│ ◉  Membro                           │
│    Acesso padrão ao workspace.      │
└─────────────────────────────────────┘
```

- Card: `border border-default rounded-md p-3 flex items-start gap-3 cursor-pointer transition-colors duration-fast`.
- Selected: `border-accent bg-accent-soft text-text-primary` and the radio dot fills with `accent`.
- Hover (when not selected): `bg-surface-sunken`.
- Focus-visible: standard focus ring on the radio's underlying input.
- Disabled: never disabled in normal flow. (If the org has zero remaining "admin" slots due to a future quota system, the admin card disables with tooltip.)
- Title `text-sm font-medium`. Subtitle `text-xs text-muted` (`text-text-disabled` on the selected card for contrast against `accent-soft` — verify ratio ≥ 4.5:1; if not, use `text-text-muted` instead).

#### Note: "Dono" is never offered

Per product decision in 00-overview §3, the owner role cannot be granted via invite. The UI does not even render this option. (The role enum on the client side for this modal is `'member' | 'admin'`, not the full Role type.)

#### Keyboard

- Radio group is one tab-stop. Inside, `↓/→` and `↑/←` switch selection.
- Pressing `Enter` on a card selects it AND submits is NOT triggered (focus stays on the group).
- The actual submit happens via the primary button or `Enter` when focus is in the email input.

---

## 4. Buttons

### Cancelar (secondary)
- `variant=secondary`, `text-sm`.
- Closes modal: `uiStore.closeModal()`. Form state is discarded.
- No confirm on close, even with unsaved input. The form is short.

### Enviar convite (primary)
- `variant=primary` (accent fill), `text-sm font-medium`.
- Disabled when:
  - Email is empty.
  - Email is invalid format (local check).
  - Mutation is in flight.
- Loading state: button content swaps to spinner + "Enviando..."; `aria-busy="true"`; `disabled`.
- On click: triggers form submit.

---

## 5. Submission flow

```
1. validate locally
2. if invalid: show inline error on the offending field, focus it
3. mutate: POST /api/v1/invitations  body: { email, role }
4. on success:
   a. toast.success(t.invitations.modal.sentToast(email))   // "Convite enviado para X"
   b. uiStore.closeModal()
   c. queryClient.invalidateQueries({ queryKey: ['invitations', orgId] })
   d. announce(t.invitations.modal.sentAnnouncement(email))  // for SR
5. on error:
   a. parseApiError(err)
   b. if status === 409 && code is "member_exists" or "invitation_pending":
        set email field error inline, keep modal open
   c. else if status === 422 with fieldErrors:
        map each field error to the matching input
   d. else if status === 429:
        toast.error(parseApiError.title, { description })  // "Aguarde alguns instantes..."
        keep modal open, re-enable submit
   e. else:
        toast.error("Não foi possível enviar o convite", { description: parseApiError.message })
        keep modal open
```

Notes:
- On any error, focus moves to the first field with an error (or back to the email field for non-field errors).
- The form is never auto-cleared on error — the user shouldn't have to retype.

---

## 6. Error scenarios — exhaustive

| Trigger | UI response | Where |
|---|---|---|
| Local: empty email | "Informe um email." | Inline under email field |
| Local: invalid format | "Email inválido." | Inline under email field |
| Server 409 already member | "Esta pessoa já é membro desta organização." | Inline under email field |
| Server 409 already pending | "Já existe um convite pendente para este email." | Inline under email field |
| Server 422 email field | Backend message (mapped) | Inline under email field |
| Server 422 role field | "Função inválida." (shouldn't happen — UI constrains) | Inline below role group |
| Server 429 rate limit | "Você atingiu o limite de convites por agora." + backend description | Toast |
| Server 403 (member tried to invite — shouldn't happen since button is hidden) | "Você não tem permissão para enviar convites." | Toast; close modal |
| Server 5xx | Generic "Algo deu errado..." from parseApiError | Toast; keep modal open |
| Network | "Verifique sua internet e tente novamente." | Toast; keep modal open |

---

## 7. Success behavior

- Toast (sonner-style, `role="status"`):
  - Title: `t.invitations.modal.sentToastTitle` — "Convite enviado"
  - Description: `t.invitations.modal.sentToastBody(email)` — "Enviamos um link para X"
  - Action button on the toast: none. (No "Reverter" — revoke flow lives in the list.)
- Live region (`#shell-live`): "Convite enviado para X" (same phrasing, more verbose).
- Modal unmounts via Radix Dialog close → focus returns to the "Convidar membro" trigger button.
- The pending list section refetches and the new row appears (no animation entry beyond the section's normal mount transition).

---

## 8. Accessibility

- Dialog primitive: focus trap, ESC to close, `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing to the title.
- Initial focus: email input (NOT the close button — matches `multi-tenancy-ui/06` §4 rule for input-led modals like Create Org).
- Close-on-outside-click: enabled. Close-on-Esc: enabled. Both return focus to the trigger.
- The role radio group has `role="radiogroup"` (Radix default) and `aria-labelledby` pointing to the "Função" label.
- Inline field errors use `role="alert"` so they're announced when they appear.
- The submit button announces its loading state via `aria-busy="true"`. The button label changes to "Enviando..." so SR users hear the change.
- Reduced motion: opacity-only entry; no scale, no translate.

---

## 9. Visual states summary

| Field state | Visual |
|---|---|
| Email default | Standard input border |
| Email focus | `border-accent`, focus ring |
| Email error | `border-danger`, error message replaces helper |
| Email disabled (during submit) | `bg-surface-sunken`, `text-disabled`, `cursor-not-allowed` |
| Role default selection | `member` card has `border-accent bg-accent-soft` |
| Role hover (other card) | `bg-surface-sunken` |
| Role focus | Focus ring on radio input |
| Role disabled (future quota case) | `opacity-50 cursor-not-allowed`, tooltip explains |
| Submit default | Accent button |
| Submit disabled | `opacity-50`, no pointer events |
| Submit loading | Spinner + "Enviando...", `aria-busy` |

---

## 10. Mobile layout

```
┌────────────────────────────────────┐
│ Convidar membro              [×]   │
│ Envie um convite por email para    │
│ alguém entrar na sua organização.  │
├────────────────────────────────────┤
│                                    │
│ Email                              │
│ ┌────────────────────────────────┐│
│ │                                ││
│ └────────────────────────────────┘│
│ Enviaremos um convite com link...  │
│                                    │
│ Função                             │
│ ┌────────────────────────────────┐│
│ │ ◉ Membro                       ││
│ │   Acesso padrão ao workspace.  ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ ○ Administrador                ││
│ │   Pode gerenciar membros e     ││
│ │   configurações.               ││
│ └────────────────────────────────┘│
│                                    │
├────────────────────────────────────┤
│ [ Cancelar ]    [ Enviar convite ] │
└────────────────────────────────────┘
```

- Role cards stack vertically on `< md`.
- Footer buttons keep horizontal layout (compact); if needed, "Cancelar" is text-only and "Enviar convite" is full primary.
- Body grows; modal max-height is `90vh` with `overflow-y-auto`.

---

## 11. Open judgment calls

- **Default role = `member`**: safest. Some products default to "same as inviter" (so admins invite admins by default). Defensible alternative; not picked because it implicitly skews the org toward more admins over time.
- **Radio cards vs simple radio list vs select**: chose cards because (a) two options only, (b) each option benefits from the one-line description. A select dropdown would hide the descriptions until clicked.
- **No bulk-invite affordance**: deliberately out of scope (00-overview §2). A "Adicionar outro" link could be added later inline.
- **No "Send invite with message" textarea**: out of scope. If added, it goes below the role group, optional, character-limited to ~280.
- **Submit button label**: "Enviar convite" (verb-noun) vs "Convidar" (verb only). Picked verb-noun for clarity. Backend reuses "Enviar convite" copy in confirmation surfaces too.
- **Auto-suggest from past invites**: not implemented. If the org has many members and admins re-invite the same domains, an `<input list>` of recent domains could speed it up. Future iteration.
