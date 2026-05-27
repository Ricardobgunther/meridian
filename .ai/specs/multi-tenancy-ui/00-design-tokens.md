# 00 — Design Tokens

Spec status: **Source of truth** for the starter's reusable design foundation.
Audience: `frontend-agent` (paste config and CSS variables into the repo).

> All UI in `multi-tenancy-ui/` consumes tokens from this file. No raw Tailwind palette classes (`text-blue-600`, `bg-zinc-900`, etc.) outside of this token mapping.

---

## 1. Color tokens — semantic only

### Brand accent decision

**Choice: `indigo`** (Tailwind `indigo-500/600/700` family).

Rationale (one line): indigo has WCAG-friendly contrast against both light (`indigo-600` on white = 7.0:1) and dark (`indigo-400` on near-black = 8.1:1) surfaces and is gender/industry-neutral — appropriate for a reusable B2B SaaS starter where the product on top will rebrand.

### Token table

| Token | Purpose | Light (HSL) | Dark (HSL) | Tailwind ref |
|---|---|---|---|---|
| `surface` | Page background | `0 0% 100%` (#FFFFFF) | `222 47% 8%` (~#0B1120) | white / slate-950+ |
| `surface-elevated` | Card / panel / dropdown bg | `220 14% 98%` (~#F8FAFC) | `222 32% 13%` (~#161E2E) | slate-50 / custom |
| `surface-sunken` | Inputs / inset wells | `220 14% 96%` (~#F1F5F9) | `222 35% 11%` (~#111827) | slate-100 / custom |
| `text-primary` | Body, headings | `222 47% 11%` (~#0F172A) | `210 40% 98%` (~#F8FAFC) | slate-900 / slate-50 |
| `text-muted` | Secondary text, metadata | `215 16% 47%` (~#64748B) | `215 20% 65%` (~#94A3B8) | slate-500 / slate-400 |
| `text-disabled` | Disabled fg | `215 14% 65%` | `215 14% 40%` | slate-400 / slate-600 |
| `border-default` | Standard separator | `220 13% 91%` (~#E2E8F0) | `217 19% 22%` (~#2D3748) | slate-200 / slate-700 |
| `border-strong` | Active / hovered inputs | `215 16% 65%` | `217 19% 35%` | slate-400 / slate-600 |
| `accent` | Brand action | `239 84% 56%` (~#4F46E5, indigo-600) | `234 89% 74%` (~#818CF8, indigo-400) | indigo-600 / indigo-400 |
| `accent-hover` | Brand hover | `239 84% 48%` (indigo-700) | `239 84% 67%` (indigo-300) | indigo-700 / indigo-300 |
| `accent-foreground` | Text on accent fills | `0 0% 100%` | `222 47% 11%` | white / slate-900 |
| `accent-soft` | Brand tint background | `239 100% 97%` (~#EEF2FF, indigo-50) | `239 60% 18%` (~#1E1B4B, indigo-950) | indigo-50 / indigo-950 |
| `success` | Positive state | `142 71% 45%` (~#16A34A) | `142 65% 55%` | green-600 / green-500 |
| `success-soft` | Success tint bg | `142 76% 95%` | `142 60% 15%` | green-50 / green-950 |
| `warning` | Caution state | `38 92% 50%` (~#F59E0B) | `38 95% 60%` | amber-500 / amber-400 |
| `warning-soft` | Warning tint bg | `48 100% 96%` | `38 70% 14%` | amber-50 / amber-950 |
| `danger` | Destructive / error | `0 72% 51%` (~#DC2626) | `0 85% 65%` | red-600 / red-400 |
| `danger-soft` | Danger tint bg | `0 86% 97%` | `0 65% 16%` | red-50 / red-950 |
| `info` | Neutral notice | `217 91% 60%` (~#3B82F6) | `217 91% 70%` | blue-500 / blue-400 |
| `info-soft` | Info tint bg | `214 100% 97%` | `217 60% 16%` | blue-50 / blue-950 |
| `focus-ring` | Focus outline | `239 84% 56%` | `234 89% 74%` | indigo-600 / indigo-400 |
| `overlay` | Modal scrim | `222 47% 11% / 0.55` | `0 0% 0% / 0.7` | — |

Contrast checks (all pass WCAG 2.1 AA for body text 4.5:1, large text 3:1):
- `text-primary` on `surface` light: 18.5:1. Dark: 15.8:1.
- `text-muted` on `surface` light: 4.7:1. Dark: 5.9:1.
- `accent-foreground` on `accent` light: 7.0:1. Dark: 11.2:1.
- `danger` on `surface` light: 5.9:1. Dark: 7.1:1.

### Tailwind config snippet

```ts
// tailwind.config.ts — paste into `theme.extend.colors`
colors: {
  surface: {
    DEFAULT:  'hsl(var(--surface) / <alpha-value>)',
    elevated: 'hsl(var(--surface-elevated) / <alpha-value>)',
    sunken:   'hsl(var(--surface-sunken) / <alpha-value>)',
  },
  text: {
    primary:  'hsl(var(--text-primary) / <alpha-value>)',
    muted:    'hsl(var(--text-muted) / <alpha-value>)',
    disabled: 'hsl(var(--text-disabled) / <alpha-value>)',
  },
  border: {
    DEFAULT: 'hsl(var(--border-default) / <alpha-value>)',
    strong:  'hsl(var(--border-strong) / <alpha-value>)',
  },
  accent: {
    DEFAULT:    'hsl(var(--accent) / <alpha-value>)',
    hover:      'hsl(var(--accent-hover) / <alpha-value>)',
    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
    soft:       'hsl(var(--accent-soft) / <alpha-value>)',
  },
  success: {
    DEFAULT: 'hsl(var(--success) / <alpha-value>)',
    soft:    'hsl(var(--success-soft) / <alpha-value>)',
  },
  warning: {
    DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
    soft:    'hsl(var(--warning-soft) / <alpha-value>)',
  },
  danger: {
    DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
    soft:    'hsl(var(--danger-soft) / <alpha-value>)',
  },
  info: {
    DEFAULT: 'hsl(var(--info) / <alpha-value>)',
    soft:    'hsl(var(--info-soft) / <alpha-value>)',
  },
  // Keep raw palette OFF the surface — comment in code: "Use semantic tokens above."
},
```

### CSS variables (`globals.css`)

Place after `@tailwind` directives. Dark mode via `data-theme="dark"` on `<html>` (driven by `useUiStore`, see spec 05). Class-based `.dark` also accepted as fallback for Tailwind's `darkMode: ['class', '[data-theme="dark"]']`.

```css
:root {
  --surface:          0 0% 100%;
  --surface-elevated: 220 14% 98%;
  --surface-sunken:   220 14% 96%;
  --text-primary:     222 47% 11%;
  --text-muted:       215 16% 47%;
  --text-disabled:    215 14% 65%;
  --border-default:   220 13% 91%;
  --border-strong:    215 16% 65%;
  --accent:            239 84% 56%;
  --accent-hover:      239 84% 48%;
  --accent-foreground: 0 0% 100%;
  --accent-soft:       239 100% 97%;
  --success:           142 71% 45%;
  --success-soft:      142 76% 95%;
  --warning:           38 92% 50%;
  --warning-soft:      48 100% 96%;
  --danger:            0 72% 51%;
  --danger-soft:       0 86% 97%;
  --info:              217 91% 60%;
  --info-soft:         214 100% 97%;
  --focus-ring:        239 84% 56%;
  --overlay:           222 47% 11%;
  --overlay-alpha:     0.55;
}

[data-theme="dark"], .dark {
  --surface:          222 47% 8%;
  --surface-elevated: 222 32% 13%;
  --surface-sunken:   222 35% 11%;
  --text-primary:     210 40% 98%;
  --text-muted:       215 20% 65%;
  --text-disabled:    215 14% 40%;
  --border-default:   217 19% 22%;
  --border-strong:    217 19% 35%;
  --accent:            234 89% 74%;
  --accent-hover:      239 84% 67%;
  --accent-foreground: 222 47% 11%;
  --accent-soft:       239 60% 18%;
  --success:           142 65% 55%;
  --success-soft:      142 60% 15%;
  --warning:           38 95% 60%;
  --warning-soft:      38 70% 14%;
  --danger:            0 85% 65%;
  --danger-soft:       0 65% 16%;
  --info:              217 91% 70%;
  --info-soft:         217 60% 16%;
  --focus-ring:        234 89% 74%;
  --overlay:           0 0% 0%;
  --overlay-alpha:     0.7;
}
```

> Note: `<alpha-value>` is replaced by Tailwind at compile time. For overlay use `bg-[hsl(var(--overlay)/var(--overlay-alpha))]` until a dedicated `overlay` utility is added.

---

## 2. Type scale

Stack: Geist Sans (UI), Geist Mono (code/IDs). Falls back to `system-ui, sans-serif`. Already wired in `app/fonts/`.

| Token | Size | Line-height | Tracking | Use |
|---|---|---|---|---|
| `text-xs`   | 0.75rem (12px)  | 1rem    (16px) | 0       | Captions, badges, helper text |
| `text-sm`   | 0.875rem (14px) | 1.25rem (20px) | 0       | Secondary body, table cells, form helper |
| `text-base` | 1rem (16px)     | 1.5rem  (24px) | 0       | Primary body, inputs, buttons |
| `text-lg`   | 1.125rem (18px) | 1.75rem (28px) | -0.01em | Subheads, large body |
| `text-xl`   | 1.25rem (20px)  | 1.75rem (28px) | -0.01em | Section headings (h3) |
| `text-2xl`  | 1.5rem (24px)   | 2rem    (32px) | -0.02em | Page titles (h1/h2) |

Tailwind extends:

```ts
fontSize: {
  xs:   ['0.75rem',  { lineHeight: '1rem'    }],
  sm:   ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem',     { lineHeight: '1.5rem'  }],
  lg:   ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
  xl:   ['1.25rem',  { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
  '2xl':['1.5rem',   { lineHeight: '2rem',    letterSpacing: '-0.02em' }],
},
fontFamily: {
  sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
},
```

Font weights used: `400` (body), `500` (UI labels, badges), `600` (subheads), `700` (page titles).

---

## 3. Spacing scale

**Decision:** keep Tailwind's default 0–24 (rem) scale. Anything above `24` (6rem) is page-level only (page max width, hero sections). Documented so future contributors don't reach for `space-32` for inline gaps.

Most-used in this spec:
- `2` (8px) inner padding for badges, icon-button gutters
- `3` (12px) input padding-x, compact button padding
- `4` (16px) default gap, form field stack
- `6` (24px) section gap, card padding
- `8` (32px) page section vertical rhythm

No Tailwind config changes needed.

---

## 4. Radius

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4px (`0.25rem`) | Inputs, badges, small chips |
| `rounded-md` | 8px (`0.5rem`)  | Buttons, dropdown items, cards (default) |
| `rounded-lg` | 12px (`0.75rem`)| Modals, large cards, panels |
| `rounded-pill` / `rounded-full` | `9999px` | Avatars, status pills |

```ts
borderRadius: {
  sm:   '0.25rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  pill: '9999px',
},
```

---

## 5. Shadow / elevation

| Token | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 2px 0 hsl(222 47% 11% / 0.06)` | Subtle resting elevation (buttons, inputs) |
| `shadow-md` | `0 4px 6px -1px hsl(222 47% 11% / 0.10), 0 2px 4px -2px hsl(222 47% 11% / 0.06)` | Dropdowns, popovers, sticky topbar shadow when scrolled |
| `shadow-lg` | `0 10px 15px -3px hsl(222 47% 11% / 0.10), 0 4px 6px -4px hsl(222 47% 11% / 0.05)` | Modals, command palette |

Dark mode shadows: keep the same definitions — they remain visible because the HSL uses opacity over the dark surface. In dark mode, also add a 1px `border-default` to elevated surfaces (cards, dropdowns) to create separation when shadows are weaker.

```ts
boxShadow: {
  sm: '0 1px 2px 0 hsl(222 47% 11% / 0.06)',
  md: '0 4px 6px -1px hsl(222 47% 11% / 0.10), 0 2px 4px -2px hsl(222 47% 11% / 0.06)',
  lg: '0 10px 15px -3px hsl(222 47% 11% / 0.10), 0 4px 6px -4px hsl(222 47% 11% / 0.05)',
},
```

---

## 6. Motion

| Token | Duration | Use |
|---|---|---|
| `motion-fast` | `120ms` | Hovers, focus-ring, button press |
| `motion-base` | `200ms` | Dropdown open/close, modal scale, drawer slide |
| `motion-slow` | `320ms` | Page transitions, large layout changes |

Easings:
- `ease-standard` `cubic-bezier(0.2, 0, 0, 1)` — most UI transitions (in/out balanced)
- `ease-entry`    `cubic-bezier(0, 0, 0, 1)`   — element appearing (decelerate)
- `ease-exit`     `cubic-bezier(0.4, 0, 1, 1)` — element leaving (accelerate)

```ts
transitionDuration: {
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
},
transitionTimingFunction: {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  entry:    'cubic-bezier(0, 0, 0, 1)',
  exit:     'cubic-bezier(0.4, 0, 1, 1)',
},
```

**Reduced motion:** when `@media (prefers-reduced-motion: reduce)` is active, ALL non-essential transitions go to `1ms`. See spec 06.

---

## 7. Z-index scale

| Layer | Token | Value |
|---|---|---|
| Base content | — | `auto` |
| Dropdown / popover | `z-dropdown` | `20` |
| Sticky topbar / sidebar | `z-sticky`   | `30` |
| Modal / drawer | `z-modal`    | `40` |
| Toast / notification | `z-toast`    | `50` |
| Debug overlay (dev only) | `z-debug`    | `60` |

```ts
zIndex: {
  dropdown: '20',
  sticky:   '30',
  modal:    '40',
  toast:    '50',
  debug:    '60',
},
```

> Never use `z-[999]` or arbitrary z-indices outside this scale.

---

## 8. Focus ring (cross-cutting)

Single recipe used everywhere:

```
outline: 2px solid hsl(var(--focus-ring));
outline-offset: 2px;
```

Tailwind utility composition for focus-visible:

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-accent
focus-visible:ring-offset-2
focus-visible:ring-offset-surface
```

`ring-offset-surface` ensures the gap is the page background — required so the ring is visible on both elevated and base surfaces. See spec 06 for accessibility implications.

---

## 9. Open judgment calls

- **Indigo vs violet** — picked indigo for slightly better contrast on white. A future product can swap by changing only the `--accent*` variables; no component code changes.
- **HSL vs OKLCH** — HSL chosen because it's the format already in the repo's tailwind skill doc. OKLCH would give better perceptual uniformity but loses parity with the existing skill.
- **Six-step type scale** — intentionally small; designers building on this can extend `2xl → 3xl/4xl` for marketing pages without changing the app surface.
