# CLAUDE.md — Projeto1

Stack: **Laravel 11** (API) · **Next.js 14** (App Router) · **Supabase** (Postgres + Auth) · **Redis** · **Docker Compose**

---

## Sistema de Agentes

Este projeto usa um sistema de agentes em `.ai/`. Antes de qualquer tarefa, identifique o agente correto:

| Agente | Domínio |
|--------|---------|
| `backend-agent` | Laravel, PHP, API REST |
| `frontend-agent` | Next.js, React, TypeScript, Tailwind |
| `database-agent` | PostgreSQL, Supabase, RLS, migrations |
| `uiux-agent` | Design system, acessibilidade, tokens |
| `devops-agent` | Docker, CI/CD, Nginx |
| `testing-agent` | Pest, Vitest, Playwright |
| `review-agent` | Segurança, performance, qualidade |

Leia o arquivo do agente em `.ai/agents/<nome>.md` antes de agir no domínio dele.

**Separação obrigatória:**
- `backend-agent` → nunca toca `.tsx`
- `frontend-agent` → nunca toca migrations ou `routes/api.php`
- `database-agent` → nunca escreve lógica de negócio

---

## Contexto Permanente

Leia antes de decisões arquiteturais:

- `.ai/context/project-stack.md` — versões, arquitetura, comandos
- `.ai/context/architecture-decisions.md` — ADRs (por que as coisas são como são)
- `.ai/context/conventions.md` — nomenclatura, estilo, tamanhos de arquivo

---

## Skills — Referenciar nos Prompts

| Skill | Quando usar |
|-------|------------|
| `.ai/skills/laravel-best-practices.md` | Qualquer código PHP/Laravel |
| `.ai/skills/api-security.md` | Endpoints, auth, validação |
| `.ai/skills/supabase-patterns.md` | Auth, queries, RLS, realtime |
| `.ai/skills/frontend-design.md` | Componentes, hooks, estado |
| `.ai/skills/tailwind-guidelines.md` | Classes CSS, design tokens |
| `.ai/skills/testing-rules.md` | Escrever ou revisar testes |
| `.ai/skills/docker-workflows.md` | Container, compose, deploy |

---

## Convenções Essenciais

**Commits** (inglês, imperativo):
```
feat(invoices): add comment system
fix(auth): resolve 500 on expired token
```

**Branches:**
```
feature/nome-curto
fix/descricao-bug
hotfix/critico
```

**API:** todas as rotas em `/api/v1/`. Resposta sempre `{ "data": ... }`.

**Erros para usuário:** português, amigável, sem detalhes técnicos.

**Tamanhos máximos:** Controller 200 linhas · Service 300 · Componente 200 · Hook 100.

**Soft delete** em todas as tabelas de domínio (`deleted_at`).

---

## Regras de Segurança (inegociáveis)

1. Nunca commitar `.env` com valores reais
2. Nunca expor stack trace ao usuário em produção
3. Sempre usar Eloquent ou bindings parametrizados (nunca query raw com input)
4. Sempre validar + autorizar antes de agir
5. Nunca logar dados pessoais ou financeiros

---

## Workflows

| Situação | Seguir |
|----------|--------|
| Nova feature | `.ai/workflows/feature-development.md` |
| Bug reportado | `.ai/workflows/bugfix-flow.md` |
| Antes de PR | `.ai/workflows/code-review-flow.md` |
| Deploy | `.ai/workflows/deploy-flow.md` |

---

## Antes de Qualquer Merge

1. `review-agent` aprovou? ← obrigatório
2. CI passando? ← obrigatório
3. `testing-agent` cobriu? ← obrigatório
4. Staging verificado? ← obrigatório para features

---

## Comandos Rápidos

```bash
make up                        # inicia tudo
make down                      # para tudo
make shell                     # shell no container PHP
make artisan cmd="migrate"     # php artisan migrate
make test                      # todos os testes
```
