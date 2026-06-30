# 04 — i18n Strings

Spec status: Source of truth for every PT-BR string introduced by this block.
Depends on: `multi-tenancy-ui/06-accessibility-and-i18n.md` §8 (dictionary-based strategy already in place at `frontend/lib/i18n/dict/pt-BR/`).

> Existing namespaces: `shell`, `orgs`, `settings`. This block adds a new namespace: **`invitations`**.
>
> File: `frontend/lib/i18n/dict/pt-BR/invitations.ts`. Wired through `lib/i18n/t.ts` so consumers access via `t.invitations.*`.

Tone rules (carry over from existing dicts):
- Educated, concise. Avoid corporate filler ("nossa equipe") unless the inviter is named.
- "Convite" not "invite" (no anglicisms). "Reenviar" not "Re-enviar".
- Imperative buttons. Verb-noun for primary CTAs ("Enviar convite", "Aceitar convite").
- Person references in singular neutral where possible. "A pessoa", "o administrador", "o convidado".

---

## 1. Top-level shape

```
t.invitations = {
  list:    { ... },   // pending list section (spec 01)
  modal:   { ... },   // invite-by-email modal (spec 02)
  accept:  { ... },   // public /invite/[token] page (spec 03)
  errors:  { ... },   // shared error mappings from backend codes
  roles:   { ... },   // re-export of role labels filtered to invitable roles
}
```

---

## 2. `invitations.list` — Pending Invitations section

| Key | PT-BR |
|---|---|
| `sectionTitle` | "Convites pendentes" |
| `sectionTitleWithCount(n)` | `Convites pendentes (${n})` |
| `collapseToggleHide` | "Ocultar convites pendentes" |
| `collapseToggleShow` | "Mostrar convites pendentes" |
| `columnEmail` | "Email" *(visually hidden header — for screen readers only)* |
| `columnRole` | "Função" *(SR-only)* |
| `columnInviter` | "Convidado por" *(SR-only)* |
| `columnExpires` | "Expira em" *(SR-only)* |
| `columnActions` | "Ações" *(SR-only)* |
| `invitedBy(name)` | `convidado por ${name}` |
| `inviterNoLongerMember` | "Não é mais membro." *(tooltip)* |
| `expiresIn(rel)` | `${rel}` *(passes through the Intl.RelativeTimeFormat result, e.g. "em 6 dias")* |
| `expiresInTooltip(fullDate)` | `Expira em ${fullDate}` |
| `expiresUrgent` | "Expira em breve" *(visually-hidden alt text when row is in danger color)* |
| `actionsMenu(email)` | `Mais ações para ${email}` |
| `actionResend` | "Reenviar convite" |
| `actionRevoke` | "Revogar convite" |
| `resendBusy` | "Reenviando..." *(SR-only announcement for the resending row)* |
| `resentToast` | "Convite reenviado" |
| `resentToastBody(email)` | `Enviamos um novo link para ${email}.` |
| `resentAnnouncement(email)` | `Convite reenviado para ${email}` |
| `resendError` | "Não foi possível reenviar o convite." |
| `resendRateLimitedTitle` | "Aguarde para reenviar" |
| `resendRateLimitedBody` | "Você já reenviou este convite recentemente. Tente novamente em alguns instantes." |
| `confirmRevokeTitle` | "Revogar convite?" |
| `confirmRevokeBody(email)` | `O link enviado para ${email} deixará de funcionar imediatamente. Você pode enviar um novo convite a qualquer momento.` |
| `confirmRevokeCta` | "Revogar" |
| `confirmRevokeCancel` | "Cancelar" |
| `revoking` | "Revogando..." |
| `revokedToast` | "Convite revogado" |
| `revokedToastBody(email)` | `O convite para ${email} foi cancelado.` |
| `revokedAnnouncement(email)` | `Convite para ${email} revogado` |
| `revokeError` | "Não foi possível revogar o convite." |
| `emptyTitle` | "Nenhum convite pendente." |
| `emptyHint` | "Use o botão \"Convidar membro\" acima para começar." |
| `loadingError` | "Não foi possível carregar os convites." |
| `retry` | "Tentar novamente" |

---

## 3. `invitations.modal` — Invite by email modal

| Key | PT-BR |
|---|---|
| `triggerCta` | "Convidar membro" *(button in Members section header)* |
| `quotaExceededTooltip` | "Limite de membros atingido. Atualize o plano." *(disabled-button tooltip; future use)* |
| `title` | "Convidar membro" |
| `description` | "Envie um convite por email para alguém entrar na sua organização." |
| `closeLabel` | "Fechar" |
| `emailLabel` | "Email" |
| `emailPlaceholder` | "exemplo@empresa.com" |
| `emailHelper` | "Enviaremos um convite com link para essa pessoa." |
| `roleLabel` | "Função" |
| `roleMemberTitle` | "Membro" |
| `roleMemberDescription` | "Acesso padrão ao workspace." |
| `roleAdminTitle` | "Administrador" |
| `roleAdminDescription` | "Pode gerenciar membros e configurações." |
| `cancel` | "Cancelar" |
| `submit` | "Enviar convite" |
| `submitting` | "Enviando..." |
| `sentToastTitle` | "Convite enviado" |
| `sentToastBody(email)` | `Enviamos um link para ${email}.` |
| `sentAnnouncement(email)` | `Convite enviado para ${email}` |
| `errors.emailRequired` | "Informe um email." |
| `errors.emailInvalid` | "Email inválido." |
| `errors.emailAlreadyMember` | "Esta pessoa já é membro desta organização." |
| `errors.emailAlreadyPending` | "Já existe um convite pendente para este email." |
| `errors.roleRequired` | "Selecione uma função." |
| `errors.roleInvalid` | "Função inválida." |
| `errors.rateLimitedTitle` | "Limite de convites atingido" |
| `errors.rateLimitedBody` | "Você atingiu o limite de convites por agora. Tente novamente em alguns instantes." |
| `errors.forbidden` | "Você não tem permissão para enviar convites." |
| `errors.network` | "Verifique sua internet e tente novamente." |
| `errors.generic` | "Não foi possível enviar o convite." |

---

## 4. `invitations.accept` — Public /invite/[token] page

### Shared

| Key | PT-BR |
|---|---|
| `pageTitleWithOrg(orgName)` | `Convite — ${orgName}` |
| `pageTitleGeneric` | "Convite" |
| `helpFooter` | "Precisa de ajuda? Fale com a pessoa que enviou o convite." |
| `goHome` | "Ir para a página inicial" |

### State: ready (authenticated)

| Key | PT-BR |
|---|---|
| `readyTitlePrefix` | "Você foi convidado a entrar em" |
| `readySubtitle(role, inviter)` | `como ${role}, por ${inviter}.` |
| `readyEmailLabel(email)` | `Convite para: ${email}` |
| `decline` | "Recusar" |
| `accept` | "Aceitar" |
| `accepting` | "Aceitando..." |
| `declining` | "Recusando..." |
| `acceptSuccessAnnouncement(orgName)` | `Convite aceito. Bem-vindo(a) a ${orgName}.` |
| `declineSuccessAnnouncement` | "Convite recusado." |
| `inlineErrorTitle` | "Não foi possível concluir" |
| `inlineErrorGeneric` | "Tente novamente em instantes." |

### State: ready (not authenticated)

| Key | PT-BR |
|---|---|
| `anonTitlePrefix` | "Você foi convidado a entrar em" |
| `anonBody(email)` | `Faça login ou crie uma conta com ${email} para aceitar.` |
| `anonCta` | "Entrar ou criar conta" |
| `anonHelper` | "Ao continuar, seu convite ficará pendente até você finalizar o login." |

### State: expired

| Key | PT-BR |
|---|---|
| `expiredTitle` | "Este convite expirou." |
| `expiredBody` | "Peça um novo ao administrador da organização." |

### State: revoked

| Key | PT-BR |
|---|---|
| `revokedTitle` | "Este convite foi revogado." |
| `revokedBody` | "O administrador cancelou este convite. Entre em contato com a organização se precisar de acesso." |

### State: invalid / not found

| Key | PT-BR |
|---|---|
| `invalidTitle` | "Convite não encontrado." |
| `invalidBody` | "O link pode estar incompleto ou ter sido digitado errado." |

### State: wrong-email guard

| Key | PT-BR |
|---|---|
| `wrongEmailTitle` | "Este convite foi enviado para outro email." |
| `wrongEmailConnectedAs(email)` | `Você está conectado como ${email}.` |
| `wrongEmailExpected(email)` | `Para aceitar este convite, entre com ${email}.` |
| `wrongEmailSignOut` | "Sair desta conta" |
| `signingOut` | "Saindo..." |

---

## 5. `invitations.errors` — backend code mappings

The frontend maps a backend error `code` (string returned in the JSON body) to a UI message. If the backend returns a PT-BR `error` field, the UI uses it directly; this table is the fallback when only a code is present, and the canonical phrasing the backend should match.

| Backend code | Title | Body |
|---|---|---|
| `invitation_not_found` | "Convite não encontrado" | "O link pode estar incompleto ou ter sido digitado errado." |
| `invitation_expired` | "Convite expirado" | "Peça um novo ao administrador da organização." |
| `invitation_revoked` | "Convite revogado" | "Este convite foi cancelado." |
| `invitation_email_mismatch` | "Email não confere" | "Este convite foi enviado para outro email." |
| `invitation_already_member` | "Já é membro" | "Esta pessoa já é membro desta organização." |
| `invitation_already_pending` | "Convite já enviado" | "Já existe um convite pendente para este email." |
| `invitation_rate_limited` | "Limite de convites atingido" | "Você atingiu o limite de convites por agora." |
| `invitation_resend_rate_limited` | "Aguarde para reenviar" | "Você já reenviou este convite recentemente." |
| `invitation_role_invalid` | "Função inválida" | "Escolha entre Membro ou Administrador." |
| `invitation_quota_exceeded` | "Limite de membros atingido" | "Atualize o plano para convidar mais pessoas." |
| `forbidden` | "Sem permissão" | "Você não tem permissão para esta ação." |
| `validation` | "Verifique os campos" | "Algumas informações estão incompletas ou incorretas." |
| `server` | "Erro inesperado" | "Algo deu errado do nosso lado. Tente novamente em instantes." |
| `network` | "Sem conexão" | "Verifique sua internet e tente novamente." |

> The list above is the contract: backend-agent returns one of these codes (in `body.code` when shaping API errors) so the frontend doesn't have to string-match messages. See `06-flows-and-errors.md` §1.

---

## 6. `invitations.roles` — filtered role labels

| Key | PT-BR |
|---|---|
| `member` | "Membro" *(short — used in pending row badge)* |
| `admin` | "Admin" *(short — used in pending row badge)* |
| `memberFull` | "Membro" *(long — used on accept page subtitle)* |
| `adminFull` | "Administrador" *(long — used on accept page subtitle)* |

> Re-using `t.orgs.roleBadge` and `t.orgs.roleFull` is also acceptable; this nested namespace is provided so consumers in `invitations/` don't have to reach across dicts. Frontend-agent picks one — but stays consistent within the block.

---

## 7. File skeleton (for the frontend-agent)

```ts
// frontend/lib/i18n/dict/pt-BR/invitations.ts
export const invitations = {
  list: {
    sectionTitle: 'Convites pendentes',
    sectionTitleWithCount: (n: number) => `Convites pendentes (${n})`,
    collapseToggleHide: 'Ocultar convites pendentes',
    collapseToggleShow: 'Mostrar convites pendentes',
    // ...
  },
  modal: {
    triggerCta: 'Convidar membro',
    title: 'Convidar membro',
    // ...
    errors: {
      emailRequired: 'Informe um email.',
      // ...
    },
  },
  accept: {
    pageTitleWithOrg: (orgName: string) => `Convite — ${orgName}`,
    // ...
  },
  errors: {
    invitation_not_found: {
      title: 'Convite não encontrado',
      body: 'O link pode estar incompleto ou ter sido digitado errado.',
    },
    // ...
  },
  roles: {
    member: 'Membro',
    admin: 'Admin',
    memberFull: 'Membro',
    adminFull: 'Administrador',
  },
} as const;
```

And wired through `frontend/lib/i18n/t.ts`:

```ts
import { invitations } from './dict/pt-BR/invitations';

export const t = {
  shell,
  orgs,
  settings,
  invitations,
} as const;
```

---

## 8. Open judgment calls

- **"Convite" vs "invite"**: 100% Portuguese. Never use anglicism here even if internal slack does.
- **"Aceitar" vs "Aceitar convite" on the button**: chose short "Aceitar" because the surrounding heading already says "Você foi convidado…". The accept page is uncluttered enough.
- **"Recusar" vs "Não aceitar" vs "Declinar"**: "Recusar" — short, clear, not pejorative.
- **"Email" vs "E-mail"**: existing dicts use both inconsistently (`orgs.ts` uses "e-mail", `settings.ts` uses "e-mail"). This dict uses **"email"** (without hyphen) — the unhyphenated form is now standard in PT-BR per VOLP. Frontend-agent: pick one and propagate. Recommend a tiny follow-up to normalize earlier dicts.
- **Inviter naming on toasts vs announcements**: announcements are slightly more verbose ("Convite enviado para X" vs toast "Convite enviado / Enviamos um link para X"). Spec keeps this split because SR users benefit from one-shot context while sighted users get a title + body.
- **Backend error codes as canonical contract**: the backend-agent commits to returning these codes in `body.code`. If backend can't comply, frontend falls back to status-code-based mapping in `parseApiError` (`06-flows-and-errors.md` §1).
