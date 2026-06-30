# 03 — Slug Availability Preview

Spec status: Component-level. Closes the TODO from `multi-tenancy-ui/03-create-org-modal.md` §8 ("when /api/v1/organizations/check-slug exists, add live preview").
Depends on: overview D2 (backend `GET /organizations/check-slug` — **blocker**), J4 (advisory-only doctrine), `04-i18n-strings.md`, `05-state-and-data-flow.md`.

Scope: the slug field of `CreateOrgForm.tsx` (create-org modal). The settings `GeneralForm` slug field is explicitly out of scope (§7).

---

## 1. Behavior

A status line under the slug field reports availability while the user types. It is **advisory**: it never disables submit, and the `422` from `POST /organizations` remains the source of truth (overview J4; the entire spec-03 §4 submit flow is unchanged).

### Trigger rules

The check fires only when ALL hold:

1. Slug is non-empty and matches the client pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` with length 3–60 (never send garbage to the API; the field's own validation messages cover invalid input).
2. The value has been stable for the **debounce window: 400ms** (matches the existing 400ms debounce convention from spec 03 §2.1/§2.2).
3. The form is not submitting.

Also checks slugs produced by the auto-derive-from-name behavior (the user sees feedback even before touching the slug field) — the check observes the slug *value*, not the input's touched flag.

### Result lifecycle

- Each keystroke immediately invalidates the previous result (status returns to idle/checking — never show a stale verdict for a different string).
- In-flight request is aborted on change (pass `AbortSignal`; TanStack Query key change handles this — see `05-state-and-data-flow.md` §2).
- Results are cached briefly (`staleTime 30s`) so toggling back to a recently-checked slug doesn't refetch.
- After a `POST /organizations` returns `422 errors.slug` for slug S, the cached result for S is overwritten to `available: false` (the server just told us authoritatively).

---

## 2. Visual states

The status line renders in a reserved slot below the existing helper/error text of the slug field: `flex items-center gap-1.5 text-sm min-h-5` — `min-h-5` (20px) reserves the row so the modal does not jump between states.

```
Identificador (slug)
┌─────────────────────────────────────────────┐
│ acme-brasil                                  │
└─────────────────────────────────────────────┘
Será usado em URLs: app.exemplo.com/org/acme-brasil      ← existing helper (unchanged)
✓ Disponível                                             ← NEW status line
```

| State | Icon (16px, `aria-hidden`) | Text (PT-BR) | Tokens |
|---|---|---|---|
| Idle (empty / pattern-invalid / check disabled) | — | *(empty; row keeps `min-h-5`)* | — |
| Checking | `SpinnerIcon` (existing, `h-4 w-4`) | "Verificando disponibilidade…" | `text-text-muted` |
| Available | `Check` | "Disponível" | `text-success` |
| Taken | `AlertCircle` | "Este identificador já está em uso. Tente outro." | `text-danger` |
| Check failed (network/5xx/429) | — | *(empty — silently degrade to idle; never block, never alarm)* | — |

Notes:

- **Taken** reuses the exact string of `t.orgs.create.errors.slugTaken` so the live preview and the post-submit 422 read identically — one message, two moments.
- **Taken does NOT set `invalid` on the `Input`** and does not replace the helper text: the field-error slot (`org-slug-error`, `role="alert"`) remains owned by the form's validation/422 path. The status line is a parallel, softer channel. This also keeps `aria-invalid` truthful — the value is *valid input*, just (advisorily) unavailable.
- **Taken does NOT disable "Criar"** (J4). If the user submits anyway, the existing 422 path takes over.
- Color is never the only signal: icon + text in every non-idle state (and the taken text is self-explanatory without color).
- Contrast: `success` on `surface-elevated` = green-600 on near-white ≈ 3.3:1 — for 14px text this fails 4.5:1. **Therefore the Available state must render the `Check` icon in `text-success` but the word "Disponível" in `text-text-primary`** — icon conveys polarity redundantly with position; text passes AA. Same treatment is NOT needed for danger (`danger` on light surface = 5.9:1, passes) but apply the identical structure (`text-danger` icon + `text-danger` text is fine) for consistency of implementation.

---

## 3. Accessibility

- Status container: `aria-live="polite"` + `aria-atomic="true"` — announces "Disponível" / "Este identificador já está em uso…" after the debounce settles. Polite, never assertive (the user is mid-typing).
- "Verificando disponibilidade…" IS announced (it's inside the live region) — acceptable: it fires at most once per 400ms pause, and silence-then-verdict is more confusing for SR users than progress-then-verdict. If testing shows chattiness, frontend-agent may move the checking text outside the live region and keep only verdicts live — document the choice in code.
- The live region is **separate** from `org-slug-helper` / `org-slug-error` (`aria-describedby` continues to point at helper-or-error exactly as today; do not add the status line to `aria-describedby` — live region already reaches SR users, and double-announcement is noise).
- The spinner icon carries no label of its own (text accompanies it).

---

## 4. Component contract

New reusable component `frontend/components/ui/SlugAvailability.tsx` (UI layer, dumb):

```tsx
interface SlugAvailabilityProps {
  status: 'idle' | 'checking' | 'available' | 'taken';
  /** Slug the verdict refers to — render-guard against stale display. */
  slug?: string;
}
```

Logic lives in a hook `frontend/hooks/use-check-slug.ts` → `useCheckSlug(slug: string)` returning `{ status }` (debounce + pattern gate + query + 422-overwrite subscription). Hook ≤ 100 lines (convention). `CreateOrgModal` (the stateful parent of `CreateOrgForm`) wires hook → form prop; `CreateOrgForm` stays a pure presenter and just renders `<SlugAvailability …/>` under the slug field.

Splitting dumb component + hook is what makes the settings-form reuse (§7) a drop-in later.

---

## 5. Flow examples

```
A. Happy path
   types "acme" → (400ms) → GET check-slug?slug=acme → { available: true }
   → "✓ Disponível" announced politely → user clicks Criar → 201 (unchanged flow).

B. Taken, user insists
   types "acme" → check → { available: false } → "⚠ já está em uso" → user clicks
   Criar anyway → POST → 422 errors.slug → field error path (spec 03 §4 5b) highlights
   the input. No contradiction: same sentence in both places.

C. Check endpoint down
   types "acme" → check → 500 → status line stays empty, helper text untouched →
   user submits → POST is the truth. Zero degradation vs the pre-feature behavior.

D. Fast typing
   "a" → "ac" → "acm" → "acme" within 400ms → exactly one request (for "acme").
   "acme" → backspace to "acm" → previous verdict cleared instantly, new debounce.
```

---

## 6. Motion

None. State swaps are instant text/icon changes — a fade would delay the verdict for no benefit and add reduced-motion surface area.

---

## 7. Out of scope / follow-up

- **Settings `GeneralForm` slug field**: same component + hook apply 1:1 with one extra rule — `available: false` must be suppressed when the typed slug equals the org's **current** slug (it's "taken" by yourself). Left as a follow-up TODO comment in `SlugAvailability` so the next block picks it up.
- **HEAD-request variant** (spec 03 §2.2 option a) is superseded by D2's GET contract.

---

## 8. Open judgment calls

- **Taken does not block submit** — the instruction-level requirement covered check *failure*; this spec extends non-blocking to confirmed-taken too. Rationale: the check can be stale either way, the POST 422 is free, and a disabled-submit driven by an advisory endpoint is a lockout risk (e.g. flaky network returning cached `false`). Cost: an occasional pointless POST.
- **400ms debounce** — matches the block's existing debounce convention (300–400ms range in shipped specs). Faster (250ms) burns requests; slower (600ms+) feels laggy after a typing pause.
- **"Disponível" in `text-text-primary` with success icon** — strictly an AA-contrast accommodation (§2). The alternative (bump font to large-text 3:1 threshold) would break the 14px helper rhythm.
- **Announcing "checking"** — included in the live region by default; see §3 for the sanctioned fallback if it proves chatty.
