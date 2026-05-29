# 03 — Public Accept Invite Page

Spec status: Page-level. Public (no auth required to load) route `/invite/[token]`.
Depends on: `multi-tenancy-ui/00-design-tokens.md`, `multi-tenancy-ui/05-state-and-data-flow.md`, `multi-tenancy-ui/06-accessibility-and-i18n.md`.

> This page is outside the application shell. No sidebar, no topbar, no org switcher. Minimal centered layout. Branding only.

---

## 1. Route & rendering strategy

- Path: `/invite/[token]` (Next.js App Router segment `app/invite/[token]/page.tsx`).
- Render mode: **Server Component** for the initial state resolution. The page calls `GET /api/v1/invitations/accept/{token}` server-side (a "preview" endpoint — does not consume the token).
- The preview endpoint returns a discriminated payload telling the page which state to render. See `05-state-and-data-flow.md` §1.
- Authentication state: resolved via `@supabase/ssr` server client from cookies. The page reads the session to:
  - Decide between authenticated card and unauthenticated card.
  - Validate the session's email matches the invite (J5 in 00-overview).
- The accept action itself (POST) is a client interaction — wrapped in a small Client Component "AcceptForm".

> Why Server Component for the initial resolve? Because the URL is publicly shareable; rendering the right card without a client flash matters for trust ("did this link work?"). A loading flicker on a token-validation page reads as broken.

---

## 2. Layout

```
        ┌──────────────────────────────────────┐
        │                                      │
        │             [ Logo ]                 │
        │                                      │
        │  ┌────────────────────────────────┐  │
        │  │                                │  │
        │  │     (state-specific card)      │  │
        │  │                                │  │
        │  └────────────────────────────────┘  │
        │                                      │
        │       Precisa de ajuda? [link]       │
        │                                      │
        └──────────────────────────────────────┘
```

- Page background: `bg-surface`.
- Outer wrapper: `min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-8`.
- Logo: top-of-card spacing, decorative (no link to dashboard from here — the page is for non-members too). Size: 32px height.
- Card: `bg-surface-elevated border border-default rounded-lg shadow-md p-6 md:p-8 w-full max-w-md`.
- Footer help link: `text-xs text-muted` — "Precisa de ajuda? Fale com a pessoa que enviou o convite." (deliberately points to inviter rather than a support page — the starter has no support routing yet).

### Semantic landmarks

- The whole page is wrapped in `<main id="main-content" tabIndex={-1}>`. Per `multi-tenancy-ui/06`, focus moves here on route entry.
- The card uses appropriate roles per state:
  - Accept-ready (states 1 + 2): no role; the card is informational.
  - Expired / revoked / invalid: `role="alert"` on the inner container — these are hard stops the user needs to know about urgently.
  - Wrong-email guard: `role="alert"`.
- Page `<title>` (set via Next.js metadata): "Convite — {orgName}" when org is known, else "Convite". This shows in the browser tab and is the first SR announcement on landing.

---

## 3. States — exhaustive

The preview endpoint returns a `status` field. The page switches on it:

| `status` | Auth state | Card variant |
|---|---|---|
| `valid` | authenticated, email matches | §3.1 Accept-ready (auth) |
| `valid` | authenticated, email mismatch | §3.6 Wrong-email guard |
| `valid` | not authenticated | §3.2 Accept-ready (login-required) |
| `expired` | any | §3.3 Expired |
| `revoked` | any | §3.4 Revoked |
| `not_found` | any | §3.5 Invalid token |

Additional client-only state during the POST submission: §3.7 Submitting.

### 3.1 Accept-ready — authenticated, email matches

```
┌──────────────────────────────────────────┐
│                                          │
│         [icon: mail-check, 48px,         │
│              text-accent]                │
│                                          │
│     Você foi convidado a entrar em       │
│           Acme Brasil                    │
│                                          │
│     como Administrador,                  │
│     por Joana Silva.                     │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  Convite para: bruno@acme.com    │   │
│   └──────────────────────────────────┘   │
│                                          │
│   [ Recusar ]            [ Aceitar ]     │
│                                          │
└──────────────────────────────────────────┘
```

- Icon: `MailCheck` (lucide-react), 48px, `text-accent`, `aria-hidden="true"`.
- Heading `<h1 className="text-2xl font-bold text-primary text-center">`. Pattern:
  - Line 1: `Você foi convidado a entrar em`
  - Line 2: `<strong>{orgName}</strong>` rendered on its own line (visual weight).
- Subtext below heading: `text-sm text-muted text-center`:
  - `como <strong>{roleLabel}</strong>, por <strong>{inviterName}</strong>.`
  - `roleLabel` uses `t.orgs.roleFull` (so "Administrador" / "Membro", never "Admin" / "Member" — formal register on a public page).
- Email pill: `bg-surface-sunken border border-default rounded-sm px-3 py-2 text-sm font-mono text-muted` — reassures the visitor the link is for them.
- Buttons:
  - "Recusar" — secondary variant. Calls POST `/api/v1/invitations/accept/{token}` with body `{ action: 'decline' }` (or the backend's equivalent decline endpoint). On success → toast + redirect to a safe landing (`/`). The decline endpoint exists in backend's contract; if it does not, the button is replaced by a small "Não quero participar" text link that just navigates away without a server call. Spec assumes decline exists; backend-agent confirms.
  - "Aceitar" — primary variant. Calls POST. On success → `router.push('/org/{newOrgSlug}')`.
- Layout: side-by-side on `md+`, stacked on `< md` with Aceitar on top.

### 3.2 Accept-ready — not authenticated

```
┌──────────────────────────────────────────┐
│                                          │
│         [icon: mail, 48px, text-accent]  │
│                                          │
│     Você foi convidado a entrar em       │
│           Acme Brasil                    │
│                                          │
│   Faça login ou crie uma conta com       │
│        bruno@acme.com                    │
│        para aceitar.                     │
│                                          │
│       [ Entrar ou criar conta ]          │
│                                          │
│   Ao continuar, seu convite ficará       │
│   pendente até você finalizar o login.   │
│                                          │
└──────────────────────────────────────────┘
```

- Single primary CTA: "Entrar ou criar conta" → `router.push('/login?invite={token}')` (or `<Link>`).
- The email line is `<p className="text-sm text-muted">` with `bruno@acme.com` as `<strong>` for prominence. Not a clickable mailto — that's distracting.
- Helper text below the button: `text-xs text-disabled`.
- Inviter is NOT shown in this state — the user is not yet authenticated; we don't need to broadcast names to anonymous clients. Org name IS shown because the invitee already knows it from the email subject line.

### 3.3 Expired

```
┌──────────────────────────────────────────┐
│                                          │
│      [icon: clock-x, 48px, text-muted]   │
│                                          │
│        Este convite expirou.             │
│                                          │
│   Peça um novo ao administrador da       │
│   organização.                           │
│                                          │
│         [ Ir para a página inicial ]     │
│                                          │
└──────────────────────────────────────────┘
```

- Heading `<h1 className="text-xl font-semibold text-primary text-center">`.
- Body: `text-sm text-muted text-center`.
- CTA: secondary variant, navigates to `/` (the marketing or root page).
- Container has `role="alert"` so SR announces "Este convite expirou" on render.

### 3.4 Revoked

```
┌──────────────────────────────────────────┐
│                                          │
│      [icon: ban, 48px, text-muted]       │
│                                          │
│       Este convite foi revogado.         │
│                                          │
│   O administrador cancelou este          │
│   convite. Entre em contato com a        │
│   organização se precisar de acesso.     │
│                                          │
│         [ Ir para a página inicial ]     │
│                                          │
└──────────────────────────────────────────┘
```

- Same chrome as Expired. `role="alert"`. Different icon and text.

### 3.5 Invalid / not found

```
┌──────────────────────────────────────────┐
│                                          │
│   [icon: help-circle, 48px, text-muted]  │
│                                          │
│      Convite não encontrado.             │
│                                          │
│   O link pode estar incompleto ou ter    │
│   sido digitado errado.                  │
│                                          │
│         [ Ir para a página inicial ]     │
│                                          │
└──────────────────────────────────────────┘
```

- `role="alert"`. Same chrome.

### 3.6 Wrong-email guard

```
┌──────────────────────────────────────────┐
│                                          │
│   [icon: user-x, 48px, text-warning]     │
│                                          │
│   Este convite foi enviado para outro    │
│   email.                                 │
│                                          │
│   Você está conectado como               │
│        bruno-pessoal@gmail.com           │
│                                          │
│   Para aceitar este convite, entre com   │
│        bruno@acme.com.                   │
│                                          │
│       [ Sair desta conta ]               │
│                                          │
└──────────────────────────────────────────┘
```

- Warning icon (yellow / amber) — not danger; the user just took a wrong turn.
- Body lists both emails clearly: the connected one and the invite target. `text-sm text-muted` body, both emails `<strong>` and in `font-mono` for unambiguous reading.
- CTA "Sair desta conta": secondary variant. Calls Supabase `signOut()`, then navigates to `/login?invite={token}` so the user can re-authenticate with the correct email.
- `role="alert"`.
- The page does NOT auto-sign-out; the user does it consciously.

### 3.7 Submitting (transient client state)

When Aceitar or Recusar is clicked:
- The clicked button shows spinner + "Aceitando..." / "Recusando..."; `aria-busy="true"`.
- The other button becomes `disabled` for the duration.
- On success → redirect (no celebratory animation; the redirect is the feedback).
- On error:
  - 410 Gone (token used between preview and POST — race): swap the card to the Expired or Revoked state without a full page reload.
  - 422 with email mismatch (auth changed between preview and POST): swap to Wrong-email guard.
  - 5xx / network: stay on the card, show inline error banner above the buttons (`role="alert"`, `bg-danger-soft border border-danger px-3 py-2 rounded-sm text-sm text-danger`), button re-enables.

---

## 4. Server vs client component split

```
app/invite/[token]/
  page.tsx               (Server Component)  ← fetches preview, picks card
  AcceptForm.tsx         (Client Component)   ← wraps Aceitar / Recusar buttons
  SignOutButton.tsx      (Client Component)   ← used in wrong-email guard
  cards/
    AcceptReadyAuthed.tsx       (Server)
    AcceptReadyAnon.tsx         (Server)
    ExpiredCard.tsx             (Server)
    RevokedCard.tsx             (Server)
    InvalidCard.tsx             (Server)
    WrongEmailCard.tsx          (Server, hosts SignOutButton)
```

Why this split:
- Server Components for static card markup so SR sees real text on first paint.
- Client islands ONLY for the mutation triggers. Smaller JS payload on a page that ~half of users will leave after clicking once.

---

## 5. Visual / token reference

- Card icons: 48px circle of `bg-accent-soft` (state 3.1, 3.2) or `bg-warning-soft` (3.6) or `bg-surface-sunken` (3.3, 3.4, 3.5) around the lucide icon. The circle is `p-3 rounded-full`, icon inside is `text-{matching-token}`.
- Buttons reuse the standard variants from `multi-tenancy-ui/00-design-tokens.md` § (implicit via existing button component).
- No motion beyond default button transitions and the modal-style entry of the card (`opacity 0 → 1` over `motion-base`, `motion-reduce:transition-none`).

---

## 6. Login redirect contract (cross-page)

The unauthenticated card's CTA points to `/login?invite={token}`. The login page (existing — not redesigned here) must:

1. Preserve `invite` query param across signup/login form submissions.
2. After successful auth (Supabase session established), check for `invite` in the URL.
3. If present, `router.replace('/invite/{token}')` instead of the default post-login landing (`/dashboard` or whatever).

**This is a small, one-place change to the existing login page.** Frontend-agent implements when this block lands. Worth noting:
- If signup requires email verification (Supabase magic link or confirmation), the verification callback URL ALSO needs to honor the `invite` param. The verification URL is built server-side from the supabase auth config; frontend-agent updates the redirect target.

---

## 7. Accessibility

- Page `<main id="main-content" tabIndex={-1}>` receives focus on mount (existing pattern from `multi-tenancy-ui/06` §4).
- Heading hierarchy: one `<h1>` per page (state-dependent text). No skipped levels.
- `aria-live` is NOT needed for state changes within this page because the user actively interacted (clicked) — async result is communicated by the redirect (success) or the inline error banner (failure, has `role="alert"`).
- All buttons have visible focus rings.
- Color: warning yellow on §3.6 must pass 3:1 against the soft background and 4.5:1 for the body text. Spec 00 already verifies this combo.
- Icons are `aria-hidden="true"`. Text carries semantic meaning.
- The email pill in §3.1 uses `<strong>` and `font-mono` — the mono font helps avoid character confusion (l/I/1). It is selectable text.
- Skip-link is NOT included on this page (no shell, nothing to skip past). Page is short enough that the first focusable element is reachable in one Tab.

---

## 8. Mobile layout

- Card max-width `max-w-md` (~480px) — works as-is on mobile with `px-4` page padding.
- Padding inside card drops from `p-8` (desktop) to `p-6` (mobile).
- Button row stacks vertically on `< md`. Primary on top.
- Logo above card stays small (32px). Could be hidden on very narrow viewports if it hurts vertical centering — not specified; let the frontend-agent judge during implementation.

---

## 9. Empty / null edge cases

- Token in URL is empty (e.g. user typed `/invite/`): Next.js routes this to a 404 by default (the dynamic segment requires a value). Frontend-agent confirms; if the framework's 404 page is too cold for this context, add a tiny `not-found.tsx` in the segment that renders the Invalid card (§3.5).
- User reloads the Accept-ready card after a successful accept (e.g. browser back button): preview now returns `not_found` (token consumed) → page renders §3.5. Acceptable.
- Org was deleted between invite send and click: preview returns `not_found` (the invite was orphaned). Acceptable; `05-state-and-data-flow.md` documents.
- Inviter was removed from the org between send and click: preview still returns `valid` with `inviter.name`. The accept-ready card shows the original inviter name. Out of frontend scope to detect "deleted inviter" — backend handles.

---

## 10. Open judgment calls

- **Decline endpoint existence**: spec assumes backend exposes a decline action. If not, the "Recusar" button is replaced with a text-only link "Não quero participar" that just navigates away. The invite then expires naturally. Backend-agent confirms.
- **Where "Recusar" sends the user**: spec sends to `/`. Alternative: a tiny confirmation page "Convite recusado. Você pode fechar esta janela." — more polite, but adds a route. Skipping for v1.
- **Inviter name on anonymous card (§3.2)**: hidden for privacy. Some products show it ("Bruno foi convidado por Joana") which reads more personal. Picked privacy-first; trivial to flip.
- **Auto-sign-out on wrong-email guard**: explicitly NOT automatic. Users own their sessions; forcing a sign-out is intrusive.
- **Logo size and placement**: small, centered above card. Not asked to design a hero. Frontend-agent uses the existing logo asset.
- **Help link copy**: "Fale com a pessoa que enviou o convite." Defaults to social escalation, not a support ticket form (which doesn't exist yet). Confirm with stakeholders if a support URL becomes available.
