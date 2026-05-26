# Spec: Auth Vertical Slice — `/login` + `/me`

> Vertical slice da primeira feature: autenticação via Supabase OAuth (Google + GitHub). **Sem email/senha. Sem cadastro.** A configuração dos providers no painel Supabase é feita pelo usuário depois — esta spec cobre apenas UI + callback handler no Next.js.

Ler antes de implementar:
- `.ai/skills/tailwind-guidelines.md`
- `.ai/skills/frontend-design.md`
- `.ai/context/conventions.md`
- `.ai/agents/uiux-agent.md`

---

## Decisões de design fixadas (e por quê)

| Decisão | Justificativa |
|---|---|
| **Paleta default do Tailwind** (`slate`/`zinc` para neutros, `red-600` erro, `indigo-600` ação primária genérica). Sem `tailwind.config.ts` custom ainda. | A spec do `uiux-agent.md` aponta tokens semânticos (`bg-surface`, `text-text-primary`, `brand-*`) como destino final, mas **eles ainda não foram setados** no projeto (`tailwind.config.ts` está zerado). Forçar tokens agora exigiria um setup paralelo só para 2 telas. Decisão: usar paleta default consistentemente, **isolada e auditável** — a migração para tokens semânticos vira um refactor mecânico (`text-slate-900` → `text-text-primary`, etc.) na próxima feature, junto com dark mode. **Não introduzir hex hardcoded em hipótese alguma** — só classes da paleta default. |
| **GitHub `bg-slate-900` (escuro), Google `bg-white` com `border-slate-300`** | Mantém identidade de marca dos providers sem hex custom. Ambos passam AA: GitHub `bg-slate-900` + `text-white` = 17.4:1; Google `bg-white` + `text-slate-900` = 17.4:1. Hierarquia visual é equivalente — nenhum CTA "vence" o outro, o usuário escolhe pelo provider, não pelo peso visual. |
| **Skeleton em `/me`, spinner só em ações pontuais** (botões "Continuar com…" e "Sair") | Padrão do `uiux-agent.md`: skeleton para leitura de dados, spinner para mutação/ação. Skeleton respeita `motion-reduce:animate-none`. Em loading de botão, **o label troca** (`"Continuar com Google"` → `"Conectando…"`) — assim leitores de tela e usuários com `prefers-reduced-motion` percebem o estado sem depender do spinner girando. |
| **Erro como faixa estática inline (não toast)** | OAuth callback retorna por redirect com `?error=...` na query — o erro é parte do estado da página, não evento transiente. `aria-live="polite"` + `role="status"` para leitores de tela. |
| **`/me` é Server Component; ações são Client Components mínimos** | `frontend-design.md`: page busca dado no servidor (`supabase.auth.getUser()` via SSR client). Apenas `<SignOutButton>` e `<OAuthButton>` são `'use client'`. Pages ≤ 150 linhas (`conventions.md`). |

---

## Estrutura de arquivos esperada

```
frontend/src/
  app/
    login/
      page.tsx                  ← Server Component, lê ?error= da URL
    me/
      page.tsx                  ← Server Component, fetch user via SSR
      loading.tsx               ← Skeleton de /me
    auth/
      callback/
        route.ts                ← Route Handler do OAuth callback
  components/
    auth/
      oauth-button.tsx          ← Client, props: provider, label, icon
      sign-out-button.tsx       ← Client, mutation pontual
      auth-error-banner.tsx     ← Server-safe, recebe message como prop
      provider-badge.tsx        ← Server, mapeia google/github → label+cor
  lib/
    supabase/
      server.ts                 ← createServerClient (cookies SSR)
      client.ts                 ← createBrowserClient
    utils.ts                    ← cn() (clsx + tailwind-merge)
```

> Frontend-agent: criar os arquivos acima. Backend Laravel **não é tocado** nesta slice — Supabase é a fonte de auth.

---

## Tela 1 — `/login`

### Propósito
Usuário **não autenticado** que tenta acessar qualquer rota protegida é redirecionado para cá. Página única e estática, sem formulário, sem campos de input.

### Layout — wireframe ASCII

```
┌──────────────────────────── viewport ────────────────────────────┐
│                                                                  │
│                                                                  │
│                  ┌──────────────────────────┐                    │
│                  │                          │                    │
│                  │   Entrar no Projeto1     │  ← h1              │
│                  │                          │                    │
│                  │   Continue com sua       │  ← p subtítulo     │
│                  │   conta Google ou GitHub.│                    │
│                  │                          │                    │
│                  │  ┌────────────────────┐  │  ← faixa erro      │
│                  │  │ ⚠ Não conseguimos │  │     (condicional)  │
│                  │  │   entrar...        │  │                    │
│                  │  └────────────────────┘  │                    │
│                  │                          │                    │
│                  │  ┌────────────────────┐  │                    │
│                  │  │ G  Continuar com   │  │  ← CTA Google      │
│                  │  │    Google          │  │                    │
│                  │  └────────────────────┘  │                    │
│                  │                          │                    │
│                  │  ┌────────────────────┐  │                    │
│                  │  │ ⌥  Continuar com   │  │  ← CTA GitHub      │
│                  │  │    GitHub          │  │                    │
│                  │  └────────────────────┘  │                    │
│                  │                          │                    │
│                  └──────────────────────────┘                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
        max-w-sm, centralizado vertical+horizontal
```

### Hierarquia visual e classes Tailwind

**Wrapper de página** (`<main>`):
```
min-h-screen w-full
flex items-center justify-center
bg-slate-50
px-4 py-12
```

**Card central** (`<section role="region" aria-labelledby="login-title">`):
```
w-full max-w-sm
flex flex-col gap-6
rounded-xl border border-slate-200 bg-white
p-6 sm:p-8
shadow-sm
```

**Título h1** — `id="login-title"`:
```
text-2xl font-semibold tracking-tight text-slate-900
```
> Texto: `Entrar no Projeto1`

**Subtítulo p**:
```
text-sm leading-relaxed text-slate-600
```
> Texto: `Continue com sua conta Google ou GitHub.`

**Stack de botões** (`<div>`):
```
flex flex-col gap-3
```

**Botão "Continuar com Google"** — `<button type="button">`:
```
inline-flex w-full items-center justify-center gap-3
h-11 rounded-md px-4
bg-white text-slate-900
border border-slate-300
text-sm font-medium
transition-colors duration-150
hover:bg-slate-50
active:bg-slate-100
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-60
motion-reduce:transition-none
```

**Botão "Continuar com GitHub"** — `<button type="button">`:
```
inline-flex w-full items-center justify-center gap-3
h-11 rounded-md px-4
bg-slate-900 text-white
border border-slate-900
text-sm font-medium
transition-colors duration-150
hover:bg-slate-800
active:bg-slate-950
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-60
motion-reduce:transition-none
```

**Ícone do provider** (16×16): à esquerda do label, `aria-hidden="true"`. Usar `lucide-react` (`Github` para GitHub) e SVG inline para o Google (lucide não tem). Tamanho `h-5 w-5`, `shrink-0`.

### Estados — `/login`

| Estado | Comportamento |
|---|---|
| **Idle** | Card renderizado, ambos botões habilitados, sem banner de erro. |
| **Loading (botão clicado)** | Apenas o botão clicado vira `disabled` + `aria-busy="true"`. Label troca: `"Continuar com Google"` → `"Conectando…"`. Spinner `h-4 w-4 animate-spin motion-reduce:animate-none` (border `border-2 border-current/30 border-t-current rounded-full`) substitui o ícone do provider. **O outro botão permanece clicável** até o redirect acontecer (cancela a primeira intenção implicitamente). |
| **Error** | Vindo de `/login?error=oauth_failed` (ou similar). Renderiza `<AuthErrorBanner>` acima dos botões. Botões voltam ao estado idle. Foco programaticamente vai para o banner no mount (acessibilidade). |
| **Success** | Não há estado de sucesso em `/login` — o callback redireciona direto para `/me`. |

### `<AuthErrorBanner>` — spec

```
role="status"
aria-live="polite"
tabIndex={-1}              ← permite focus programático

div className="
  flex items-start gap-3
  rounded-md border border-red-200 bg-red-50
  p-3
  text-sm text-red-800
"
  AlertCircle (lucide) h-5 w-5 shrink-0 text-red-600 aria-hidden="true"
  span: Não conseguimos entrar. Tente novamente.
```

Mensagens (mapa `error code → texto pt-BR`, todos amigáveis):
- `oauth_failed` → `Não conseguimos entrar. Tente novamente.`
- `access_denied` → `Você cancelou o login. Tente novamente quando quiser.`
- `provider_disabled` → `Este provedor está temporariamente indisponível.`
- _fallback_ → `Algo deu errado no login. Tente novamente.`

### Responsividade — `/login`
- `<sm` (mobile): card ocupa `max-w-sm` com `px-4 py-12` no wrapper; padding interno do card `p-6`.
- `≥sm`: padding interno do card sobe para `p-8`; layout não muda (single column é intencional).
- Sem media queries adicionais.

### Acessibilidade — `/login`
- `<main>` envolve a tela.
- `<section aria-labelledby="login-title">` com `<h1 id="login-title">`.
- Botões são `<button type="button">` (não `<a>`), porque disparam OAuth flow via JS handler que chama `supabase.auth.signInWithOAuth`.
- `aria-busy="true"` no botão em loading.
- Ordem de tab natural: erro (se houver, via focus programático no mount) → Google → GitHub.
- Foco visível: anel `ring-2 ring-indigo-600 ring-offset-2`, nunca `outline-none` sozinho.
- Contraste verificado: todos os pares texto/fundo ≥ 4.5:1 (Google 17.4:1, GitHub 17.4:1, erro 8.2:1, subtítulo 7.5:1).
- Ícones decorativos: `aria-hidden="true"`. Label completo do botão é o texto, não o ícone.

### Animações — `/login`
- Transições de cor em hover/active: `duration-150`.
- Spinner do botão: `animate-spin` + `motion-reduce:animate-none` (degrada para ícone estático — o label `"Conectando…"` carrega a informação de estado).
- Nada de `framer-motion` nesta tela.

---

## Tela 2 — `/me`

### Propósito
Usuário **autenticado** vê seus próprios dados básicos vindos do Supabase Auth. Tela de confirmação visual de que o login funcionou — não tem edição, é read-only nesta slice.

### Layout — wireframe ASCII

```
┌──────────────────────────── viewport ────────────────────────────┐
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  ┌────┐                                                    │  │
│  │  │ AV │  Maria Silva                          ← h1         │  │
│  │  │    │  maria@exemplo.com                    ← p          │  │
│  │  └────┘                                                    │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Detalhes da conta                          ← h2           │  │
│  │  ─────────────────                                         │  │
│  │  Entrou com         [● GitHub]              ← badge        │  │
│  │  Conta criada em    25 de maio de 2026                     │  │
│  │                                                            │  │
│  │                                              ┌─────────┐   │  │
│  │                                              │  Sair   │   │  │
│  │                                              └─────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
              max-w-2xl, centralizado horizontalmente
```

### Hierarquia visual e classes Tailwind

**Wrapper de página** (`<main>`):
```
min-h-screen w-full
bg-slate-50
px-4 py-8 sm:py-12
```

**Container** (`<div>`):
```
mx-auto w-full max-w-2xl
flex flex-col gap-6
```

**Header card** (`<header>`):
```
flex items-center gap-4
rounded-xl border border-slate-200 bg-white
p-6
shadow-sm
```

**Avatar** — `<img>` se `user.user_metadata.avatar_url`, senão `<div>` com inicial:
```
h-14 w-14 shrink-0
rounded-full
border border-slate-200
object-cover
bg-slate-100
text-slate-700 font-semibold
flex items-center justify-center           ← só no fallback
```
> Se imagem: `alt="Foto de perfil de {nome}"`. Se fallback: `aria-label="Avatar de {nome}"` no wrapper div.

**Bloco texto do header**:
```
flex flex-col gap-0.5 min-w-0
```

**Nome h1**:
```
text-xl font-semibold tracking-tight text-slate-900 truncate
```

**Email p**:
```
text-sm text-slate-600 truncate
```

**Card detalhes** (`<section aria-labelledby="account-details">`):
```
flex flex-col gap-5
rounded-xl border border-slate-200 bg-white
p-6
shadow-sm
```

**h2** — `id="account-details"`:
```
text-base font-semibold text-slate-900
```
> Texto: `Detalhes da conta`

**Lista de pares label/valor** (`<dl>`):
```
grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:gap-x-6 sm:gap-y-3
```
- `<dt>`: `text-sm text-slate-600`
- `<dd>`: `text-sm text-slate-900 font-medium`

Pares:
1. `Entrou com` → `<ProviderBadge provider="google|github" />`
2. `Conta criada em` → data formatada com `Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })`

**`<ProviderBadge>`**:
```
inline-flex items-center gap-1.5
rounded-full px-2.5 py-0.5
text-xs font-medium
border
```
- `google`: `border-slate-200 bg-white text-slate-700` + ícone Google `h-3.5 w-3.5`
- `github`: `border-slate-800 bg-slate-900 text-white` + `<Github className="h-3.5 w-3.5" />`

**Rodapé do card detalhes**:
```
flex justify-end
pt-2
border-t border-slate-100
```

**Botão "Sair"** (`<SignOutButton>`, link-style destrutivo):
```
inline-flex items-center gap-1.5
h-9 px-2
rounded-md
bg-transparent
text-sm font-medium text-red-600
transition-colors duration-150
hover:bg-red-50 hover:text-red-700
active:bg-red-100
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-60
motion-reduce:transition-none
```

### Estados — `/me`

| Estado | Comportamento |
|---|---|
| **Loading (initial fetch)** | `app/me/loading.tsx` exibe skeleton: 1× header card skeleton (avatar `h-14 w-14 rounded-full bg-slate-200`, 2 linhas de texto `h-4 bg-slate-200 rounded`) + 1× detalhes card skeleton (3 linhas). Wrapper `animate-pulse motion-reduce:animate-none`. |
| **Idle (logged in)** | Renderiza header + detalhes + botão Sair, todos habilitados. |
| **Loading (botão Sair clicado)** | Botão vira `disabled` + `aria-busy="true"`. Label troca: `"Sair"` → `"Saindo…"`. Spinner `h-3.5 w-3.5 animate-spin motion-reduce:animate-none` à esquerda do label. Resto da tela permanece visível. |
| **Success (sign out)** | Redirect para `/login` (sem flash de conteúdo intermediário — o redirect acontece dentro do server action). |
| **Error (sign out falhou)** | Botão volta para idle, exibe toast `"Não conseguimos sair. Tente novamente."` OU (se toast não existir ainda) renderiza `<AuthErrorBanner>` no topo do container e foca nele. Frontend-agent escolhe o caminho consistente com o que já existe — preferência: banner inline, já que toast system não está spec'd ainda. |
| **Unauthenticated** | Server Component detecta `user === null` e redireciona via `redirect('/login')`. Usuário nunca vê `/me` sem sessão. |

### Responsividade — `/me`
- `<sm` (mobile): `<dl>` é coluna única (`grid-cols-1`), label acima do valor. Header card mantém avatar + texto lado a lado (header sempre horizontal).
- `≥sm`: `<dl>` vira grid `[160px_1fr]` (label esquerda, valor direita).
- `≥md`: nenhuma mudança adicional — `max-w-2xl` continua sendo a largura útil.

### Acessibilidade — `/me`
- `<main>` envolve a tela.
- `<header>` para o card de identidade do usuário; `<section aria-labelledby="account-details">` para o card de detalhes.
- `<dl>/<dt>/<dd>` semântico para pares label/valor (leitor de tela anuncia "Entrou com, GitHub").
- Avatar com `alt` descritivo (não "imagem de perfil" genérico — usar o nome do usuário).
- Botão Sair tem `aria-busy="true"` em loading; label muda para `"Saindo…"`.
- Foco visível com `ring-2 ring-red-600 ring-offset-2` no botão Sair (contraste sobre `bg-white`: 5.7:1, AA OK).
- Contraste: nome `text-slate-900` em `bg-white` 17.4:1; email `text-slate-600` 7.5:1; texto destrutivo `text-red-600` em `bg-white` 5.9:1; sobre `hover:bg-red-50` 5.5:1.
- Ordem de tab: link/botão de avatar (se houver — nesta slice não há) → botão Sair. Apenas 1 elemento focável nesta tela.

### Animações — `/me`
- Skeleton: `animate-pulse motion-reduce:animate-none`.
- Hover/active de botão: `duration-150`.
- Spinner do botão Sair: `animate-spin motion-reduce:animate-none`.
- Nada de `framer-motion` nesta slice.

---

## Comportamento do callback (`/auth/callback/route.ts`)

> Mínimo necessário para a UI funcionar end-to-end. Detalhe é responsabilidade do frontend-agent.

- `GET /auth/callback?code=...` → troca code por sessão via `supabase.auth.exchangeCodeForSession(code)`.
- Sucesso → `redirect('/me')`.
- Erro (sem code, exchange falhou, provider retornou erro) → `redirect('/login?error=<code>')`, onde `<code>` é um dos mapeados em `AuthErrorBanner`.

---

## Checklist de aceite (frontend-agent verifica antes de entregar)

- [ ] **Sem hex hardcoded.** Inspecionar `git diff` — toda cor vem da paleta default do Tailwind (slate/zinc/red/indigo/white). Nenhum `text-[#...]` ou `bg-[#...]`.
- [ ] **Estados de botão completos em `/login` e em "Sair".** Idle, hover, active, focus-visible, disabled, loading (com label trocado + `aria-busy`) e error (banner) renderizam conforme a spec. Testar manualmente Tab + Enter.
- [ ] **Sem usuário, `/me` redireciona para `/login`.** Server Component faz `supabase.auth.getUser()` e chama `redirect('/login')` quando `user === null`. Testar acessando `/me` em janela anônima.
- [ ] **Skeleton em `/me`, spinner apenas nos botões.** `app/me/loading.tsx` existe, usa `animate-pulse motion-reduce:animate-none` e tem dimensões aproximadas do conteúdo real (avatar circular + 2 linhas + card de detalhes).
- [ ] **Erro de OAuth é amigável e acessível.** Acessar `/login?error=oauth_failed` mostra o banner em pt-BR, com `role="status"`, `aria-live="polite"` e foco programático no banner no mount.
- [ ] **Mobile-first verificado.** Em viewport `375px` ambas as telas renderizam sem scroll horizontal; card de login centralizado; `<dl>` em `/me` empilha label/valor.
- [ ] **Contraste e foco.** Axe DevTools ou Lighthouse a11y ≥ 95 em ambas as telas. Anel de foco visível em **todos** os elementos interativos (testar com Tab puro, sem mouse).
- [ ] **Tamanho de arquivo.** Nenhum dos arquivos em `frontend/src/app/login/page.tsx`, `frontend/src/app/me/page.tsx`, `frontend/src/components/auth/*.tsx` passa de 150 linhas (página) ou 200 linhas (componente), conforme `conventions.md`.

---

## Próximo passo
Acionar o **frontend-agent** para implementar esta spec. Backend Laravel e database **não são tocados** nesta vertical slice — a autenticação é 100% Supabase via SSR no Next.js. Após implementação, acionar **testing-agent** (cobertura mínima dos componentes `auth/`) e depois **review-agent** (obrigatório antes do merge, ver `CLAUDE.md`).
