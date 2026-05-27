# Architecture Decision Records (ADRs)

Registro de decisões arquiteturais importantes, com contexto e razões.
Novos ADRs: adicionar no topo, com data e status.

---

## ADR-008 — Multi-tenancy via `Organization` + `Membership` (per-row scoping)
**Data:** 2026-05-26
**Status:** Aceito

**Contexto:** Projeto1 é um starter template SaaS reutilizável. Todo SaaS B2B precisa de algum modelo de tenant. Três abordagens possíveis: (a) database-per-tenant, (b) schema-per-tenant, (c) per-row scoping com `organization_id`.

**Decisão:** Per-row scoping (c). Toda tabela de domínio tem `organization_id UUID` FK; queries são automaticamente filtradas por tenant ativo via global scope no Eloquent.

**Razões:**
- Operacionalmente simples: um único banco, um único schema, migrations triviais.
- Compatível com Supabase RLS — `auth.uid()` + tabela `memberships` definem acesso.
- Escala para milhares de tenants sem explodir conexões ou migrations.
- Padrão da indústria para SaaS multi-tenant inicial (Linear, Notion, Vercel).

**Trade-offs:**
- Bug em scope pode vazar dados entre tenants → mitigado com testes obrigatórios de isolamento + RLS no Postgres.
- Backup/restore por tenant é mais trabalhoso → aceitável para starter.

---

## ADR-009 — Identificação de tenant via header `X-Organization-Id`
**Data:** 2026-05-26
**Status:** Aceito

**Contexto:** O cliente precisa indicar qual organização está ativa em cada request. Opções: (a) prefixo de path `/api/v1/orgs/{id}/...`, (b) header `X-Organization-Id`, (c) subdomínio `acme.app.com`.

**Decisão:** Header `X-Organization-Id: <uuid>`. Middleware `ResolveOrganization` valida que o usuário autenticado tem `Membership` ativo nessa organização e injeta `organization` + `membership` no request.

**Razões:**
- Path-based polui todas as rotas com `/{org}/` e exige duplicação no roteador.
- Subdomínio exige DNS wildcard + custom domains — overengineering para starter.
- Header desacopla recurso de tenant: a mesma rota `/api/v1/customers` serve qualquer tenant.

**Trade-offs:**
- URLs não revelam o tenant — debug requer inspecionar headers. Aceitável.
- Frontend precisa lembrar de injetar o header em todo fetch → resolvido com client wrapper único.

---

## ADR-010 — RBAC fixo com três roles: `owner`, `admin`, `member`
**Data:** 2026-05-26
**Status:** Aceito

**Contexto:** Starter precisa de RBAC, mas permissões granulares (Spatie Permission) introduzem complexidade desnecessária para a fase inicial.

**Decisão:** Enum de roles fixo em `memberships.role`: `owner`, `admin`, `member`. Policies do Laravel checam role; nenhuma tabela de permissions.

**Razões:**
- 95% dos SaaS começam com esse modelo e só evoluem para granular quando o produto exige.
- Policies em código são auditáveis no PR — vs permissions em DB que mudam runtime.
- Migrar para Spatie depois é direto se necessário.

**Trade-offs:**
- Customização exige edição de código → aceitável para starter B2B típico.

---

## ADR-011 — `users` local com PK UUID espelhando `auth.uid()`
**Data:** 2026-05-26
**Status:** Aceito

**Contexto:** Hoje `MeController` lê claims do JWT diretamente — não há linha local para o usuário. Para FKs (memberships, audit, etc.) precisamos de uma linha em `users`.

**Decisão:** Tabela `users` com `id UUID PRIMARY KEY` igual ao `sub` do JWT do Supabase (`auth.uid()`). Upsert na primeira request autenticada (listener no `VerifySupabaseToken` ou middleware dedicado). Sem coluna `password` — auth é 100% Supabase.

**Razões:**
- FKs precisam de PK estável e referenciável.
- Manter o ID idêntico ao Supabase simplifica RLS (`auth.uid() = users.id`).
- Upsert lazy evita webhook do Supabase (que exigiria endpoint público).

**Trade-offs:**
- Primeira request após signup é levemente mais lenta (1 INSERT).
- Dados do usuário ficam parcialmente duplicados (email no Supabase + email local) → aceitável; usamos `email` local apenas como cache.

---

## ADR-012 — Sem auto-criação de "organização pessoal" no signup
**Data:** 2026-05-26
**Status:** Aceito

**Contexto:** Alguns SaaS criam uma "personal org" automaticamente para cada usuário; outros exigem que o usuário crie/seja convidado para uma organização.

**Decisão:** Não criar org automaticamente. Após primeiro login, se o usuário não pertence a nenhuma organização, o frontend mostra empty state com CTA "Criar organização" ou "Aguardar convite".

**Razões:**
- Mais flexível para um starter: serve tanto B2B (org criada por admin) quanto produto onde admin convida todos.
- Evita orgs órfãs no banco quando usuário só existe para ser convidado.
- Padrão Linear/GitHub — não Vercel.

**Trade-offs:**
- Onboarding tem uma etapa extra → resolvido com fluxo claro no frontend.

---

## ADR-007 — Usar Supabase Auth em vez de Laravel Passport
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Precisamos de autenticação com suporte a OAuth social, MFA e gerenciamento de sessões multi-device.

**Decisão:** Usar Supabase Auth como provedor de identidade primário. Laravel valida tokens JWT do Supabase.

**Razões:**
- Supabase Auth tem OAuth social (Google, GitHub) out-of-the-box
- MFA nativo sem código adicional
- JWT stateless — sem tabela de sessões no banco
- Integração nativa com RLS do Supabase

**Trade-offs:**
- Dependência de serviço externo para auth
- Laravel não gerencia tokens — validação via JWT decode

---

## ADR-006 — TanStack Query para cache de dados no cliente
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Frontend precisa de cache de dados com invalidação, retry e sincronização com o servidor.

**Decisão:** Usar TanStack Query (React Query) para todos os fetches no cliente.

**Razões:**
- Cache automático com staleTime configurável
- Retry em caso de erro de rede
- Optimistic updates built-in
- Deduplicação de requests
- Integração com Suspense

**Trade-offs:**
- Curva de aprendizado para o padrão de mutations
- Estado do servidor e estado de UI são gerenciados separadamente (Zustand para UI)

---

## ADR-005 — Soft Delete em vez de Delete Físico
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Dados de negócio (faturas, clientes) nunca devem ser deletados permanentemente por operação de usuário.

**Decisão:** Todas as tabelas de domínio têm `deleted_at TIMESTAMPTZ` para soft delete.

**Razões:**
- Auditoria: "quem deletou o quê e quando"
- Recuperação acidental
- Conformidade com LGPD (dados podem ser anonimizados, não deletados)
- Relacionamentos preservados

**Trade-offs:**
- Índices parciais obrigatórios em todas as queries (`WHERE deleted_at IS NULL`)
- Limpeza periódica de dados antigos via job agendado

---

## ADR-004 — API Versionada (/api/v1/)
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Frontend e mobile vão consumir a mesma API. Mudanças breaking precisam ser gerenciadas.

**Decisão:** Todas as rotas em `/api/v1/`. Mudanças breaking criam `/api/v2/`.

**Razões:**
- Permite deprecar v1 gradualmente
- Mobile apps têm ciclo de atualização lento
- Documentação por versão

**Trade-offs:**
- Duplicação temporária de código entre versões
- Versões antigas precisam ser mantidas por período definido

---

## ADR-003 — Zustand para Estado Global de UI
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Precisamos de estado global para UI (modais abertos, tema, sidebar).

**Decisão:** Zustand para estado de UI. TanStack Query para estado de servidor.

**Razões:**
- API simples comparado ao Redux
- TypeScript nativo
- Sem boilerplate
- Estado de UI != estado de servidor (separar claramente)

**Trade-offs:**
- Não usar para dados do servidor (usar TanStack Query)
- Evitar estado global desnecessário

---

## ADR-002 — Docker Compose para Desenvolvimento Local
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Time usa Linux (WSL2), Mac e Windows. Ambiente deve ser idêntico para todos.

**Decisão:** Docker Compose para todos os serviços locais.

**Razões:**
- "Funciona na minha máquina" eliminado
- Mesmo PHP, Node e Redis para todos
- `make up` inicia tudo em 1 comando

**Trade-offs:**
- Overhead de Docker em Mac (I/O lento com volumes)
- Curva de aprendizado inicial

---

## ADR-001 — Laravel API + Next.js Frontend Separados
**Data:** 2026-05  
**Status:** Aceito

**Contexto:** Escolher entre Laravel fullstack (Inertia/Blade) ou API separada.

**Decisão:** Laravel apenas como API. Next.js como frontend separado.

**Razões:**
- Frontend pode ser deployado na Vercel (edge, CDN global)
- Times frontend e backend podem trabalhar independentemente
- Next.js App Router tem melhor suporte a Server Components e streaming
- Mobile app futura pode reusar a mesma API

**Trade-offs:**
- CORS necessário
- Dois deployments para gerenciar
- Auth mais complexa (tokens vs. sessões)
