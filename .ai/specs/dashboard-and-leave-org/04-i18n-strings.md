# 04 — i18n Strings

Spec status: Source of truth for every PT-BR string introduced by this block.
Depends on: dictionary strategy at `frontend/lib/i18n/dict/pt-BR/` (namespaces today: `shell`, `orgs`, `settings`, `invitations`).

This block adds **one new namespace** (`dashboard`, new file `dict/pt-BR/dashboard.ts`, wired through `lib/i18n/t.ts`) and **extends two existing ones** (`settings.leaveOrg.*`, `orgs.create.slugCheck.*`).

Tone rules (carried over): educated, concise; no anglicisms in rendered copy ("organização", not "org"); imperative buttons; **"email" without hyphen** (decision recorded in `invitations-ui/04-i18n-strings.md` §8 — new strings follow it even though `orgs.ts`/`settings.ts` still contain legacy "e-mail"; the normalization follow-up remains open).

---

## 1. `dashboard` — new namespace

### `dashboard.header`

| Key | PT-BR |
|---|---|
| `greetingMorning(name?)` | `Bom dia, ${name}` / sem nome: `Bom dia` |
| `greetingAfternoon(name?)` | `Boa tarde, ${name}` / sem nome: `Boa tarde` |
| `greetingEvening(name?)` | `Boa noite, ${name}` / sem nome: `Boa noite` |
| `subtitle(orgName)` | `Aqui está um resumo de ${orgName}.` |
| `subtitleNoOrg` | "Aqui está um resumo da sua organização." *(org fetch error fallback, spec 01 §6.3)* |

> Implementation shape: one function `greeting(period, name)` is also acceptable; keys above pin the copy, not the signature.

### `dashboard.stats`

| Key | PT-BR |
|---|---|
| `sectionTitle` | "Visão geral" |
| `members` | "Membros" |
| `pendingInvites` | "Convites pendentes" |
| `role` | "Sua função" |
| `createdAt` | "Criada em" |
| `viewDetails` | "Ver detalhes" *(SR-only suffix on link-cards)* |
| `loadError` | "Não foi possível carregar" *(SR-only next to the "—" value)* |
| `retry(label)` | `Tentar novamente: ${label}` *(aria-label of the per-card retry button)* |

Role values reuse `t.orgs.roleFull.*` ("Proprietário" / "Administrador" / "Membro") — no duplication.

### `dashboard.actions`

| Key | PT-BR |
|---|---|
| `sectionTitle` | "Ações rápidas" |
| `inviteTitle` | "Convidar membro" |
| `inviteDescription` | "Chame alguém para o seu time." |
| `settingsTitle` | "Configurações" |
| `settingsDescription` | "Nome, identificador e membros." |
| `createOrgTitle` | "Nova organização" |
| `createOrgDescription` | "Crie outro espaço de trabalho." |

### `dashboard.states`

| Key | PT-BR |
|---|---|
| `noActiveOrgTitle` | "Nenhuma organização ativa" |
| `noActiveOrgBody` | "Escolha uma organização no seletor acima ou crie uma nova para começar." |
| `noActiveOrgCta` | "Criar organização" |
| `orgErrorBody` | "Não foi possível carregar os dados da organização." |
| `orgErrorRetry` | "Tentar novamente" |

Loading announcement reuses `t.shell.loading.title`.

---

## 2. `settings.leaveOrg` — extension of `settings.ts`

| Key | PT-BR |
|---|---|
| `title` | "Sair da organização" |
| `body(orgName)` | `Você perderá o acesso a ${orgName}. Para voltar, será necessário receber um novo convite.` |
| `ownerHint` | "Donos só podem sair quando houver outro Dono na organização." |
| `cta` | "Sair da organização" |
| `confirmTitle(orgName)` | `Sair de ${orgName}?` |
| `confirmBody` | "Você perderá o acesso imediatamente. Para voltar, será necessário receber um novo convite." |
| `confirm` | "Sair da organização" |
| `cancel` | "Cancelar" |
| `leaving` | "Saindo…" |
| `successToast` | "Você saiu da organização" |
| `successToastBody(orgName)` | `Você não faz mais parte de ${orgName}.` |
| `announcement(orgName)` | `Você saiu de ${orgName}.` *(polite live region)* |
| `errors.loneOwner` | "Você é a única pessoa proprietária desta organização. Promova outro membro a Dono antes de sair." |
| `errors.generic` | "Não foi possível sair da organização. Tente novamente." |

Notes:
- "Dono" capitalized as role name, consistent with `t.orgs.roleBadge.owner` and the promote dialog of spec 04 §4.3.
- `errors.loneOwner` is the canonical phrasing for backend `code: 'lone_owner'`. If the response has no `code` but a PT-BR `body.error`, the UI shows `body.error` (backend's `LoneOwnerException` message). Mapping precedence: `code` → dict; else `body.error`; else `errors.generic`.

---

## 3. `orgs.create.slugCheck` — extension of `orgs.ts`

| Key | PT-BR |
|---|---|
| `checking` | "Verificando disponibilidade…" |
| `available` | "Disponível" |
| `taken` | *(reuse `t.orgs.create.errors.slugTaken` — "Este identificador já está em uso. Tente outro." Do NOT duplicate the string; reference the existing key.)* |

The check-failed state renders no string by design (spec 03 §2).

---

## 4. Backend code contract additions

Extending the code→copy contract pattern from `invitations-ui/04-i18n-strings.md` §5:

| Backend code | Endpoint | Title (toast contexts) | Body |
|---|---|---|---|
| `lone_owner` | `POST /organizations/{id}/leave` (422) | "Você é a única pessoa proprietária" | `settings.leaveOrg.errors.loneOwner` |

(`check-slug` returns no error codes the UI surfaces — failures degrade silently per overview J4.)

---

## 5. File skeleton (for the frontend-agent)

```ts
// frontend/lib/i18n/dict/pt-BR/dashboard.ts
export const dashboard = {
  header: {
    greetingMorning: (name?: string) => (name ? `Bom dia, ${name}` : 'Bom dia'),
    greetingAfternoon: (name?: string) => (name ? `Boa tarde, ${name}` : 'Boa tarde'),
    greetingEvening: (name?: string) => (name ? `Boa noite, ${name}` : 'Boa noite'),
    subtitle: (orgName: string) => `Aqui está um resumo de ${orgName}.`,
    subtitleNoOrg: 'Aqui está um resumo da sua organização.',
  },
  stats: {
    sectionTitle: 'Visão geral',
    members: 'Membros',
    pendingInvites: 'Convites pendentes',
    role: 'Sua função',
    createdAt: 'Criada em',
    viewDetails: 'Ver detalhes',
    loadError: 'Não foi possível carregar',
    retry: (label: string) => `Tentar novamente: ${label}`,
  },
  actions: { /* §1 */ },
  states: { /* §1 */ },
} as const;
```

Wired in `t.ts`:

```ts
import { dashboard } from './dict/pt-BR/dashboard';
export const t = { shell, orgs, settings, invitations, dashboard } as const;
```

`settings.ts` gains a `leaveOrg: { ... }` object (sibling of `dangerZone`); `orgs.ts` gains `create.slugCheck: { checking, available }`.

---

## 6. Open judgment calls

- **Greeting as three keys vs one parametrized key** — three keys pin each phrase for future locales where time-of-day greetings don't share structure; the consuming code maps period→key.
- **"Você saiu da organização" toast title (generic) + org name in the body** — keeps the title short for the 4s toast scan; the name lives in the description.
- **"Nova organização" (quick action) vs "Criar organização" (existing CTAs)** — intentional: the dashboard card title is a noun-phrase tile, while modal/empty-state buttons keep the imperative "Criar organização". Both forms already coexist in the product (`createCta` vs nav labels); no conflict.
