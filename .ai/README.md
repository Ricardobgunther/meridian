# Sistema de Agentes de IA — Guia Completo

Arquitetura IA-first para desenvolvimento com múltiplos agentes especializados.
Stack: Laravel · Next.js · Supabase · Tailwind · Docker

---

## Estrutura

```
.ai/
├── agents/          — Agentes especializados por domínio
├── skills/          — Habilidades reutilizáveis entre agentes
├── workflows/       — Processos completos de desenvolvimento
├── prompts/         — Templates otimizados por tarefa
└── context/         — Contexto permanente do projeto
```

---

## Agentes Disponíveis

| Agente | Domínio | Quando Usar |
|--------|---------|-------------|
| `frontend-agent` | React, Next.js, TypeScript, Tailwind | Componentes, hooks, páginas, estado |
| `backend-agent` | Laravel, PHP, API REST | Controllers, Services, migrations, jobs |
| `uiux-agent` | Design system, UX, acessibilidade | Especificações visuais, tokens, padrões |
| `database-agent` | PostgreSQL, Supabase, RLS | Schema, queries, índices, policies |
| `devops-agent` | Docker, CI/CD, Nginx | Infraestrutura, deploy, ambiente |
| `testing-agent` | Pest, Vitest, Playwright | Testes unitários, integração, E2E |
| `review-agent` | Segurança, performance, qualidade | Code review antes do merge |

---

## Como Usar os Agentes

### No Claude Code (terminal)

```bash
# Iniciar sessão com agente específico
claude

# No prompt, identificar o agente e dar o contexto:
"Você é o backend-agent. [descrição da tarefa]"
```

### Com prompts prontos

```bash
# 1. Abrir o prompt relevante em .ai/prompts/
# 2. Copiar e adaptar o template
# 3. Colar no Claude Code com o agente identificado
```

### Combinando agentes

```bash
# Feature completa (sequencial):
# 1. database-agent  → schema e migration
# 2. backend-agent   → API endpoint
# 3. frontend-agent  → componentes e página
# 4. testing-agent   → testes
# 5. review-agent    → revisão final

# Review paralelo:
"Você é o review-agent. Revisar segurança deste endpoint [código].
 Em seguida, atue como database-agent e verificar se os índices
 estão adequados para as queries usadas."
```

---

## Exemplos Práticos de Uso

### 1. Criar Nova Feature

```bash
# Passo 1 — Planejar (qualquer agente)
"Preciso criar um sistema de tags para faturas.
 Quais tabelas, endpoints e componentes são necessários?"

# Passo 2 — Schema (database-agent)
"Você é o database-agent.
 Criar migration para tabela 'tags' e 'invoice_tags' (pivot).
 UUID como PK, RLS para que usuário veja apenas suas tags.
 Índice em invoice_id e tag_id."

# Passo 3 — API (backend-agent)
"Você é o backend-agent.
 Criar endpoints:
 GET    /api/v1/tags
 POST   /api/v1/tags
 POST   /api/v1/invoices/{invoice}/tags
 DELETE /api/v1/invoices/{invoice}/tags/{tag}
 Seguir padrões em .ai/skills/laravel-best-practices.md"

# Passo 4 — Frontend (frontend-agent)
"Você é o frontend-agent.
 Criar componente TagSelector para faturas:
 - Multi-select com busca
 - Criar nova tag inline
 - Remover tag com X
 - Usar TanStack Query para cache"

# Passo 5 — Revisar (review-agent)
"Você é o review-agent.
 Revisar os arquivos criados para a feature de tags.
 [colar o diff]"
```

### 2. Debugar Bug

```bash
# Identificar o agente pelo tipo de bug
"Você é o backend-agent.

Bug: POST /api/v1/invoices retorna 500.
Erro: 'Division by zero' em InvoiceService.php:87

Stack trace:
[colar stack trace]

Código em InvoiceService:
[colar código]

Diagnosticar e corrigir."
```

### 3. Revisar Código

```bash
"Você é o review-agent.

Revisar este PR antes do merge.
Foco: segurança, N+1 queries, autorização.

Diff:
[colar diff]

Veredicto: APROVAR / BLOQUEAR?"
```

### 4. Gerar Testes

```bash
"Você é o testing-agent.

Gerar testes completos para InvoiceController:
- Feature tests para todos os endpoints (happy path + erros)
- Unit test para InvoiceService.create()
- Usar Pest, RefreshDatabase, factories com estados

Cobrir:
- 401 sem autenticação
- 403 sem autorização
- 422 com dados inválidos
- 201 com sucesso
- DB transaction rollback em falha"
```

### 5. Otimizar Performance

```bash
"Você é o database-agent.

Este endpoint demora 800ms:
GET /api/v1/dashboard/stats

EXPLAIN ANALYZE:
[colar saída]

Queries atuais (do Telescope):
[colar N queries]

Tabela invoices tem 50.000 registros.
Otimizar para < 100ms."
```

### 6. Criar Componente UI

```bash
"Você é o uiux-agent + frontend-agent.

Criar EmptyState reutilizável:
- Ícone (Lucide)
- Título
- Subtítulo
- CTA opcional
- Responsivo, acessível
- Usar tokens do tailwind.config.ts"
```

### 7. Validar Segurança

```bash
"Você é o review-agent com foco em segurança.

Auditar estes controllers para OWASP Top 10:
[colar código]

Verificar especificamente:
- IDOR (acesso a recursos de outros usuários)
- Mass assignment
- Rate limiting
- Autorização em cada endpoint"
```

### 8. Refatorar Componente

```bash
"Você é o frontend-agent.

Este componente tem 400 linhas. Refatorar:
[colar componente]

Extrair para:
- Hook useInvoiceDetail() para lógica de dados
- InvoiceHeader — cabeçalho com ações
- InvoiceItems — tabela de itens
- InvoiceComments — seção de comentários

Manter comportamento idêntico."
```

---

## Skills — Como Usar

Skills são referências de padrões. Citar no prompt para o agente seguir:

```bash
# No prompt, referenciar a skill relevante:
"Você é o backend-agent.
 Seguir padrões de .ai/skills/laravel-best-practices.md
 e .ai/skills/api-security.md para criar este endpoint."

"Você é o frontend-agent.
 Aplicar .ai/skills/tailwind-guidelines.md
 e .ai/skills/frontend-design.md neste componente."
```

| Skill | Usar quando... |
|-------|---------------|
| `laravel-best-practices` | Qualquer código PHP/Laravel |
| `supabase-patterns` | Auth, queries, realtime, storage |
| `tailwind-guidelines` | Classes CSS e design tokens |
| `api-security` | Endpoints, autenticação, validação |
| `docker-workflows` | Container, compose, deploy |
| `testing-rules` | Escrever ou revisar testes |
| `frontend-design` | Componentes, hooks, estado React |

---

## Workflows — Quando Seguir

| Situação | Workflow |
|----------|---------|
| Começar feature nova | `workflows/feature-development.md` |
| Bug reportado | `workflows/bugfix-flow.md` |
| Antes de criar PR | `workflows/code-review-flow.md` |
| Deploy para produção | `workflows/deploy-flow.md` |

---

## Contexto Permanente

Ler antes de tomar decisões arquiteturais:

- `context/project-stack.md` — versões, arquitetura, comandos
- `context/architecture-decisions.md` — por que as coisas são como são
- `context/conventions.md` — nomenclatura, estilo, padrões

---

## Regras do Sistema

### Separação de Responsabilidades
```
backend-agent   → NUNCA toca arquivos .tsx
frontend-agent  → NUNCA toca migrations ou routes/api.php
database-agent  → NUNCA escreve lógica de negócio
devops-agent    → NUNCA toca lógica de aplicação
```

### Coordenação entre Agentes
```
Interface API mudou?  → frontend-agent + backend-agent coordenam
Schema mudou?         → database-agent notifica backend-agent
Endpoint novo?        → backend-agent descreve para frontend-agent
Design novo?          → uiux-agent especifica para frontend-agent
```

### Antes de Qualquer Merge
```
1. review-agent aprovou?     ← obrigatório
2. CI passando?              ← obrigatório
3. testing-agent cobriu?     ← obrigatório
4. Staging verificado?       ← obrigatório para features
```

---

## Adicionando Novo Agente ou Skill

### Novo Agente
```markdown
# Nome do Agente
## Identidade / Responsabilidades / Objetivos
## Stack Permitida / Regras / Anti-Patterns
## Quando Chamar Outro Agente
```

### Nova Skill
```markdown
# Skill: Nome
## Quando Usar
## [Padrões com exemplos de código]
## Anti-Patterns
```

Adicionar referência neste README na tabela correspondente.
