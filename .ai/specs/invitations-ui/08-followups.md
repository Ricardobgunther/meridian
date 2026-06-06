# Invitations — Follow-ups pós-review

Ressalvas do `review-agent` (2026-05-28) que **não bloquearam o merge** mas precisam de tratamento posterior. Veredito original: **APROVADO COM RESSALVAS**. Backend 104/104 verde; frontend 145/145 verde.

Cada item lista: arquivo / agent responsável / risco / proposta.

---

## Backend

### R1 — Resend sem rate-limit por-convite ✅ RESOLVIDO (2026-05-29)
- **Arquivo:** `backend/app/Services/InvitationService.php`
- **Agent:** `backend-agent`
- **Risco:** `guardRateLimit` conta apenas linhas `created_at >= now()-24h`. Como `resend()` muta a linha existente, um admin pode reenviar o MESMO convite N vezes sem trip do limite, gerando spam dirigido. O `throttle:60,1` do roteador é só por-IP.
- **Proposta:** rastrear `last_resent_at` na linha + aplicar cooldown (ex.: 5min), OU contar resends por `(organization_id, target_invitation_id)` em janela curta (ex.: 5/h por convite).
- **Resolução:** coluna `last_resent_at` (migration `..._000006`) + `guardResendCooldown()` com janela de 60s por convite (alinha com "1 por minuto" do `00-overview.md` §7.4). Reusa `InvitationRateLimitException` (429 `invitation_rate_limited`). Coberto por testes unitário + feature.

### R2 — Race no count do rate-limit ✅ RESOLVIDO (2026-06-06)
- **Arquivo:** `backend/app/Services/InvitationService.php` (`guardRateLimit()`)
- **Agent:** `backend-agent`
- **Risco:** `SELECT COUNT()` dentro de `DB::transaction()` no isolamento padrão (read committed) não bloqueia concorrentes. Duas requests paralelas podem passar o guard com 19 visíveis e ambas inserir → 21 total. Janela pequena, sem impacto crítico.
- **Proposta:** `LOCK TABLE invitations IN SHARE ROW EXCLUSIVE MODE` ou contagem com `FOR UPDATE` no row do organization.
- **Resolução:** lock na **linha da organization** no início de `guardRateLimit()`, antes do COUNT: `Organization::whereKey($organization->id)->lockForUpdate()->first()`. Serializa as transações `invite()`/`resend()` da mesma org até o commit, então duas requests concorrentes não conseguem ambas ler o mesmo COUNT sub-limite e inserir além dele. **Portabilidade:** no Postgres emite `SELECT ... FOR UPDATE`; no SQLite o `lockForUpdate()` é no-op inofensivo e as escritas já são serializadas globalmente, então a race não existe lá. Evitado de propósito `pg_advisory_xact_lock`/`LOCK TABLE` (quebrariam a suíte SQLite). A proteção contra a race em si só é verificável em Postgres (concorrência real); em SQLite garantimos apenas a preservação do comportamento — o teste unitário existente continua barrando o 21º convite (`tests/Unit/InvitationServiceTest.php`).

### R3 — `InvitationService` excede limite de 300 linhas
- **Arquivo:** `backend/app/Services/InvitationService.php` (481 linhas brutas, ~304 efetivas)
- **Agent:** `backend-agent`
- **Risco:** viola `.ai/context/conventions.md`. Funcionalidade está coesa, mas há espaço para extrair.
- **Proposta:** extrair `InvitationGuards` (já-membro / já-pending / rate-limit) ou `InvitationTokenIssuer` (`generateRawToken` / `hashToken` / `findByToken*`).

### R4 — Cross-tenant invitation retorna 403 em vez de 404 ✅ RESOLVIDO (2026-05-29)
- **Arquivo:** `backend/routes/api.php`
- **Agent:** `backend-agent`
- **Risco:** `SubstituteBindings` roda antes de `org.resolve`, então o bind `{invitation}` não filtra por org → cai na policy → 403. Confirma a existência do convite a um atacante em outro tenant (vazamento minor).
- **Proposta:** aninhar rota como `/organizations/{organization}/invitations/{invitation}` (mesmo padrão que `{member}` já usa), eliminando dependência do header `X-Organization-Id`.
- **Resolução:** sem mudar o contrato da API (zero respingo no frontend) — o bind `{invitation}` agora escopa pela própria `X-Organization-Id` lida do request. Id de outro tenant some no filtro → 404 na camada de binding (mesma UX que `{member}`). Header de outro tenant cai no 403 do `org.resolve` (só revela membership, não existência do convite). Testes cross-tenant de destroy/resend atualizados para 404.

### R5 — Throttle único na accept-flow ✅ RESOLVIDO (2026-06-06)
- **Arquivo:** `backend/routes/api.php:168`
- **Agent:** `backend-agent`
- **Risco:** `throttle:60,1` cobre GET preview + POST accept no mesmo bucket por IP. Com 256 bits de entropia o risco de brute-force é zero hoje, mas um throttle mais apertado no POST é defesa em profundidade.
- **Proposta:** named limiter `accept_invitation` em `AppServiceProvider` (ex.: 10/min/IP no POST).
- **Resolução:** named limiter `accept_invitation` registrado no `AppServiceProvider::boot()` — `Limit::perMinute(10)->by($request->ip())`. O grupo interno auth-required (POST accept + POST decline) passou de `Route::middleware('supabase.auth')` para `Route::middleware(['supabase.auth', 'throttle:accept_invitation'])`. O prefixo mantém `throttle:60,1` (cobre o GET preview público), então o POST fica com defesa em profundidade — 60/min do prefixo + 10/min nomeado, o mais apertado vence. Coberto por teste de feature (11 POSTs autenticados → 11º retorna 429) em `AcceptInvitationApiTest`. CACHE_STORE=array no `phpunit.xml` garante isolamento do limiter entre testes.

### R6 — Payload de accept não devolve `your_role` ✅ RESOLVIDO/OBSOLETO (2026-06-06)
- **Arquivo:** `backend/app/Http/Controllers/Api/V1/AcceptInvitationController.php:98-108`
- **Agent:** `backend-agent`
- **Risco:** frontend (`use-accept-invitation.ts:36`) precisa invalidar queries e re-buscar o role → round-trip extra após aceitar.
- **Proposta:** incluir `your_role` no payload `organization.*`.
- **Resolução:** ao reconciliar o doc com o código atual, o payload de accept **já devolve** `role` (`AcceptInvitationController.php:106`) e o tipo `AcceptResponse` (`frontend/lib/types/api.ts:173`) já o declara — o deliverable existe (nomeado `role`, não `your_role`). O "round-trip extra" residual é **intencional**: o hook faz `queryClient.invalidateQueries()` *inteiro* na troca de tenant (`use-accept-invitation.ts:34`), então semear só o role não evitaria o refetch. Sem código a fazer.

---

## Frontend

### R7 — Literal `"convidado por "` fora do dicionário ✅ RESOLVIDO (2026-06-06)
- **Arquivo:** `frontend/app/(authenticated)/org/[slug]/settings/_components/PendingInvitationRow.tsx:52`
- **Agent:** `frontend-agent`
- **Risco:** viola "nunca colar literais" do header de `invitations.ts`. Quebra futura tradução EN.
- **Proposta:** criar `t.invitations.list.invitedByLabel` (string fixa) e usar em conjunto com o tier visual já existente.
- **Resolução:** adicionada a chave fixa `invitedByLabel: 'convidado por '` em `invitations.list` e usada no span `text-text-disabled`. Não reusou a função `invitedBy(name)` existente, pois ela colapsaria a estrutura bicolor de dois spans (label cinza + nome em itálico-se-inativo). Estrutura visual preservada.

### R8 — Sign-out via `window.location.assign` perde toasts
- **Arquivo:** `frontend/app/invite/[token]/_components/SignOutButton.tsx:31`
- **Agent:** `frontend-agent`
- **Risco:** hard reload é intencional (limpar cookies stale) mas perde toasts pendentes.
- **Proposta:** ou aceitar trade-off (documentar inline), ou flushar/aguardar toast antes do reload.

### R9 — Estado `accepted` colapsado como `expired` no UX ✅ RESOLVIDO (2026-05-29)
- **Arquivo:** `frontend/app/invite/[token]/page.tsx`
- **Agent:** `frontend-agent`
- **Risco:** usuário que aceitou em outra aba vê "expirou" em vez de "já aceito" → confusão.
- **Proposta:** quarta variante `HardStopCard kind="accepted"` com mensagem "Convite já aceito" + CTA para o workspace.
- **Resolução:** adicionada a variante `HardStopCard kind="accepted"` (`role="status"`, não `alert` — estado positivo, spec §6; ícone `CheckCircle2` em `text-accent`). `resolveInitialState` mapeia `status: 'accepted' → { kind: 'accepted' }`. Como o preview de convite consumido não traz o slug da org, a CTA "Ir para o workspace" aponta para `/` (roteia o usuário autenticado). Novas strings `acceptedTitle/Body/Cta`. Coberto por teste no `InvitePageView.test.tsx`.

### R10 — Token raw em path-param de logs de access
- **Arquivo:** `frontend/app/invite/[token]/page.tsx:78-89` + observabilidade
- **Agent:** `devops-agent` (config) + `frontend-agent` (longo prazo)
- **Risco:** `/api/v1/invitations/accept/<token>` aparece em logs de access do Next runtime e ferramentas de observabilidade. O token raw é a credencial.
- **Proposta curto prazo:** documentar no runbook que rotas `/api/v1/invitations/accept/*` não devem ser logadas em produção.
- **Proposta longo prazo:** mover token para header customizado (`X-Invitation-Token`) — mudança contratual, exige coordenação com backend.

---

### R11 — Envio de email síncrono dentro da transação
- **Arquivo:** `backend/app/Services/InvitationService.php` (`dispatchInvitationMail` em `invite()` e `resend()`)
- **Agent:** `backend-agent`
- **Risco:** `Mail::...->send()` roda síncrono dentro do `DB::transaction()`. Um SMTP lento/falho segura o lock da linha (agora mais relevante após o lock por-convite do R1) e pode reverter uma mudança de estado de intenção-commitada. Levantado pelo `review-agent` ao revisar R1 — pré-existente, não introduzido por R1.
- **Proposta:** trocar para `Mail::...->queue()` ou dispatch-after-commit, depois que o worker de fila estiver no docker-compose (já há um `TODO(queue)` no método).

### R12 — Ramo `status === 409` morto no `AcceptForm` ✅ RESOLVIDO (2026-06-06)
- **Arquivo:** `frontend/app/invite/[token]/_components/AcceptForm.tsx:63-66`
- **Agent:** `frontend-agent`
- **Risco:** o fluxo de accept nunca retorna 409 (esse status só nasce em `invite()` via `InvitationAlreadyPendingException`). O ramo `setAlreadyUsed(true)`, o state `alreadyUsed` e a string `inlineErrorAlreadyUsed` são código defensivo inalcançável — confunde manutenção futura. Levantado pelo `review-agent` ao revisar R9; pré-existente, fora do escopo do R9.
- **Proposta:** remover o ramo 409 + `useState alreadyUsed`, simplificar o bloco de alerta para usar só `inlineError`; checar se `inlineErrorAlreadyUsed` ainda tem consumidor antes de remover do dicionário.
- **Resolução:** removidos o ramo 409, o state `alreadyUsed` e a simplificação do bloco de alerta para usar só `inlineError`. A string `inlineErrorAlreadyUsed` foi removida do dicionário (grep global confirmou: único consumidor era o `AcceptForm` + seu teste). Teste `it('renders the "already used" inline alert on 409', ...)` removido. Vitest verde (19 testes nos arquivos tocados), `tsc --noEmit` limpo.

---

## Infra

### R13 — Trusted proxies não configurados → throttle por IP colapsa atrás de proxy
- **Arquivo:** `backend/bootstrap/app.php`
- **Agent:** `devops-agent`
- **Risco:** não há `trustProxies` configurado. Em produção atrás de Nginx/load balancer, `$request->ip()` retorna o IP do *proxy*, não do cliente, então **todos os clientes compartilham o mesmo bucket** de qualquer throttle por IP — `throttle:60,1` E o novo `accept_invitation` (10/min) do R5. Resultado: o controle enfraquece (um cliente esgota o limite para todos) e gera falsos 429. Levantado pelo `review-agent` ao revisar R5; pré-existente — afeta todo throttle por IP do projeto, não só o accept-flow.
- **Proposta:** configurar trusted proxies em `bootstrap/app.php` (`->withMiddleware(fn ($m) => $m->trustProxies(at: '*'))` ou range específico do load balancer) antes do deploy. Coordenar com o header real que o Nginx repassa (`X-Forwarded-For`).

---

## Não-funcionais

- Total: **13 follow-ups** (6 backend, 5 frontend, 1 misto, 1 infra).
- Nenhum é blocker para merge.
- Sugestão de priorização (restantes): **R13 > R3 > R8 > R10 > R11**.
- **Status (2026-05-29):** R1 ✅, R4 ✅ e R9 ✅ resolvidos. R11 e R12 adicionados (levantados nos reviews de R1 e R9).
- **Status (2026-06-06):** R6 ✅ (obsoleto — payload já devolve `role`), R7 ✅ e R12 ✅ resolvidos. Depois, R2 ✅ (lock de linha da org, portável Postgres/SQLite) e R5 ✅ (named limiter `accept_invitation` 10/min/IP no POST) resolvidos. R13 adicionado (trusted proxies, levantado no review de R5). Restam **5**: R13, R3, R8, R10, R11.
