# Architecture Decision Records (ADRs)

Registro de decisões arquiteturais importantes, com contexto e razões.
Novos ADRs: adicionar no topo, com data e status.

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
