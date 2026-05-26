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

Os agentes são **subagents reais do Claude Code**, definidos em `.claude/agents/`.
Você **não precisa nomeá-los** — o Claude os aciona automaticamente conforme o
domínio da tarefa. Os arquivos aqui em `.ai/agents/` são a **fonte da verdade**:
cada subagent lê o `.ai/agents/<nome>.md` correspondente antes de agir.

### Fluxo automático

A sessão principal do Claude Code atua como **orquestrador**:

```
1. Dividir   → quebra a tarefa por domínio (schema? API? UI? infra?)
2. Delegar   → aciona o subagent de cada domínio na ordem de dependência
               database-agent → backend-agent → frontend-agent
               (uiux-agent antes de UI nova)
3. Testar    → testing-agent cobre o que foi implementado
4. Revisar   → review-agent SEMPRE ao final; BLOQUEIO volta para correção
```

Basta descrever a tarefa em linguagem natural. Para forçar um agente específico,
peça explicitamente (ex.: "use o database-agent para revisar os índices").

### Prompts prontos

Os templates em `.ai/prompts/` continuam úteis como referência de estrutura —
cole o conteúdo relevante no pedido quando quiser guiar uma tarefa específica.

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
