# Skill: Tailwind Guidelines

## Quando Usar
Em qualquer arquivo `.tsx`, `.jsx`, `.html` que use Tailwind CSS para estilização.

## Princípios Fundamentais

1. **Tokens antes de valores raw** — `text-text-primary` não `text-gray-900`
2. **Mobile-first** — escrever base para mobile, adicionar breakpoints para telas maiores
3. **cn() sempre** — nunca concatenação de strings para classes condicionais
4. **Variantes com CVA** — para componentes com múltiplas variações
5. **Evitar `@apply`** — usar composição de componentes, não CSS utility classes

## Configuração cn()

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Uso:
<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  hasError && 'error-classes',
  className, // permitir override externo
)} />
```

## Responsividade — Mobile-First

```tsx
// CORRETO — mobile-first
<div className="
  flex flex-col gap-4           // mobile: coluna
  md:flex-row md:gap-6          // tablet: linha
  lg:gap-8                      // desktop: gap maior
">

// ERRADO — desktop-first (evitar)
<div className="
  lg:flex-row lg:gap-8
  md:flex-row md:gap-6
  flex-col gap-4
">
```

### Breakpoints do Projeto
```
sm:   640px  — landscape mobile
md:   768px  — tablet
lg:  1024px  — desktop pequeno
xl:  1280px  — desktop
2xl: 1536px  — desktop grande
```

## Dark Mode

```tsx
// Usar variáveis CSS via tokens, não classes dark:
// PREFERIDO — tokens automáticos
<div className="bg-surface text-text-primary border-border">

// QUANDO NECESSÁRIO — classe dark: explícita
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

```css
/* globals.css — configurar tokens para light e dark */
:root {
  --surface:           240 10% 98%;
  --surface-raised:    0 0% 100%;
  --text-primary:      222 47% 11%;
  --text-secondary:    215 20% 45%;
  --border:            220 13% 91%;
  --brand-500:         217 91% 60%;
  --brand-600:         221 83% 53%;
}

.dark {
  --surface:           222 47% 11%;
  --surface-raised:    223 47% 14%;
  --text-primary:      210 40% 98%;
  --text-secondary:    215 20% 65%;
  --border:            217 32% 20%;
  --brand-500:         213 93% 68%;
  --brand-600:         217 91% 60%;
}
```

## Padrões de Layout

```tsx
// Container padrão
<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

// Grid responsivo
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

// Sidebar layout
<div className="flex min-h-screen">
  <aside className="w-64 shrink-0 border-r border-border bg-surface">
  <main className="flex-1 overflow-y-auto">

// Stack vertical com separação semântica
<div className="flex flex-col gap-6">
  <section className="rounded-xl border border-border bg-surface-raised p-6">
```

## Componentes Comuns — Implementação

```tsx
// Card padrão
<div className="rounded-xl border border-border bg-surface-raised p-6 shadow-card transition-shadow hover:shadow-md">

// Badge / Status
const statusClasses = {
  draft:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent:      'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  paid:      'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  overdue:   'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

<span className={cn(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-label font-medium',
  statusClasses[status]
)}>

// Input com estados
<input className={cn(
  // Base
  'w-full rounded-md border bg-surface px-3 py-2 text-body-md text-text-primary',
  'placeholder:text-text-disabled',
  'transition-colors duration-150',
  // Focus
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:border-transparent',
  // Disabled
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-raised',
  // Error
  hasError
    ? 'border-feedback-error focus:ring-feedback-error'
    : 'border-border hover:border-border-strong',
)} />

// Skeleton loader
<div className="animate-pulse rounded-lg bg-surface-raised">
  <div className="h-4 w-3/4 rounded bg-border" />
  <div className="mt-2 h-4 w-1/2 rounded bg-border" />
</div>
```

## Tipografia — Classes por Contexto

```tsx
// Hierarquia de títulos
<h1 className="text-display-md font-bold tracking-tight text-text-primary">
<h2 className="text-heading-lg font-semibold text-text-primary">
<h3 className="text-heading-md font-semibold text-text-primary">

// Corpo de texto
<p className="text-body-md text-text-secondary leading-relaxed">
<span className="text-body-sm text-text-secondary">

// Labels de formulário
<label className="text-label font-medium text-text-primary uppercase tracking-wide">

// Metadados e timestamps
<time className="text-body-sm text-text-secondary tabular-nums">
```

## Animações com Tailwind

```tsx
// Transição padrão de hover
<button className="transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.99]">

// Fade in (via keyframes custom)
// tailwind.config.ts:
// animation: { 'fade-in': 'fadeIn 0.2s ease-out' }
// keyframes: { fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' } } }
<div className="animate-fade-in">

// Loading spinner
<div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand-600" />
```

## Anti-Patterns
```tsx
// NUNCA — valores hardcoded de cor
className="text-[#3b82f6]"          // usar text-brand-500

// NUNCA — string concatenation
className={'flex ' + (isOpen ? 'block' : 'hidden')}  // usar cn()

// NUNCA — !important via Tailwind
className="!text-red-500"           // resolver com especificidade correta

// NUNCA — breakpoints na ordem errada
className="lg:flex md:block sm:hidden flex"  // deve ser mobile-first

// NUNCA — @apply para classes que podem ser compostas em componentes
// @apply flex items-center gap-2  ← mover para um componente React
```
