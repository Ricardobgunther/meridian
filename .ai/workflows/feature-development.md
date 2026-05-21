# Workflow: Feature Development

## Visão Geral
Processo completo para desenvolver uma nova feature do zero até o deploy, com responsabilidades claras para cada agente.

## Pré-requisitos
- Issue/ticket descrevendo a feature
- Design aprovado (mockups ou especificação do uiux-agent)
- Critérios de aceitação definidos

---

## Fase 1 — Planejamento (15 min)

**Responsável: qualquer agente iniciador**

### 1.1 Análise da Feature
```
Perguntas a responder antes de escrever código:

1. Quais tabelas são afetadas ou precisam ser criadas?
2. Quais endpoints da API são necessários?
3. Quais componentes de UI precisam ser criados/modificados?
4. Há mudanças de autorização/permissão?
5. Precisa de jobs/eventos assíncronos?
6. Qual o impacto em features existentes?
```

### 1.2 Definição de Interfaces
Definir as interfaces entre backend e frontend ANTES de implementar:

```typescript
// Contrato da API — definir primeiro
// GET /api/v1/projects
// Response:
interface ProjectListResponse {
  data: {
    id: string;
    name: string;
    status: 'active' | 'archived' | 'draft';
    members_count: number;
    created_at: string;
  }[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

// POST /api/v1/projects
// Body:
interface CreateProjectPayload {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
}
```

---

## Fase 2 — Database (database-agent)

### 2.1 Criar Migration
```bash
docker compose exec app php artisan make:migration create_projects_table
docker compose exec app php artisan make:migration add_project_id_to_tasks_table
```

### 2.2 Escrever Migration
- Seguir padrões de `.ai/skills/laravel-best-practices.md`
- UUID como PK
- Timestamps com timezone
- Foreign keys com constrained()
- Índices para queries previstas

### 2.3 Configurar RLS no Supabase
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_select_member ON projects
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));
```

### 2.4 Criar Factory
```bash
docker compose exec app php artisan make:factory ProjectFactory
```

### 2.5 Gerar Tipos TypeScript
```bash
# Após aplicar migrations no Supabase
npx supabase gen types typescript --local > types/database.types.ts
```

### 2.6 Rodar Migrations
```bash
docker compose exec app php artisan migrate
```

**Checkpoint:** `php artisan migrate:status` mostra a migration aplicada ✓

---

## Fase 3 — Backend (backend-agent)

### 3.1 Criar Model
```bash
docker compose exec app php artisan make:model Project
```

Incluir: `$fillable`, `$casts`, escopos, relacionamentos

### 3.2 Criar Enum (se aplicável)
```bash
# Criar manualmente em app/Enums/ProjectStatus.php
```

### 3.3 Criar Form Requests
```bash
docker compose exec app php artisan make:request StoreProjectRequest
docker compose exec app php artisan make:request UpdateProjectRequest
```

### 3.4 Criar API Resource
```bash
docker compose exec app php artisan make:resource ProjectResource
docker compose exec app php artisan make:resource ProjectCollection
```

### 3.5 Criar Policy
```bash
docker compose exec app php artisan make:policy ProjectPolicy --model=Project
```

Registrar no AuthServiceProvider ou via `$model` attribute no PHP 8.

### 3.6 Criar Service
```bash
# Criar manualmente em app/Services/ProjectService.php
```

Implementar métodos: `create()`, `update()`, `archive()`, `delete()`

### 3.7 Criar Controller
```bash
docker compose exec app php artisan make:controller Api/V1/ProjectController --api
```

### 3.8 Adicionar Rotas
```php
// routes/api.php
Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::apiResource('projects', ProjectController::class);
});
```

**Checkpoint:** `php artisan route:list --path=projects` mostra as rotas ✓

---

## Fase 4 — Testes de Backend (testing-agent)

### 4.1 Criar Feature Tests
```bash
docker compose exec app php artisan make:test Feature/Api/V1/ProjectTest
```

Cobrir para cada endpoint:
- [ ] Sucesso (happy path)
- [ ] Autenticação (401 sem token)
- [ ] Autorização (403 sem permissão)
- [ ] Validação (422 com dados inválidos)
- [ ] Not found (404)

### 4.2 Criar Unit Tests
```bash
docker compose exec app php artisan make:test Unit/Services/ProjectServiceTest --unit
```

### 4.3 Rodar Tests
```bash
docker compose exec app php artisan test tests/Feature/Api/V1/ProjectTest.php
docker compose exec app php artisan test --coverage
```

**Checkpoint:** Todos os testes passando, coverage > 80% ✓

---

## Fase 5 — Frontend (frontend-agent + uiux-agent)

### 5.1 Criar Tipos (se não gerados automaticamente)
```typescript
// types/project.types.ts
export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  members_count: number;
  created_at: string;
}
```

### 5.2 Criar API Client
```typescript
// lib/api/projects.ts
export const projectApi = {
  list:   (params?: QueryParams) => ...,
  get:    (id: string) => ...,
  create: (data: CreateProjectPayload) => ...,
  update: (id: string, data: Partial<CreateProjectPayload>) => ...,
  delete: (id: string) => ...,
};
```

### 5.3 Criar Custom Hooks
```typescript
// hooks/use-projects.ts
export function useProjects() { ... }
export function useCreateProject() { ... }
export function useUpdateProject() { ... }
```

### 5.4 Criar Componentes
```
components/features/projects/
  ProjectCard.tsx
  ProjectList.tsx
  CreateProjectModal.tsx
  ProjectFilters.tsx
  ProjectsEmptyState.tsx
```

### 5.5 Criar Página
```
app/(dashboard)/projects/
  page.tsx          — Server Component
  loading.tsx       — Skeleton
  error.tsx         — Error boundary
  [id]/
    page.tsx
    edit/page.tsx
```

### 5.6 Testes de Componente
```typescript
// components/features/projects/ProjectCard.test.tsx
```

**Checkpoint:** Feature visível e funcional no browser ✓

---

## Fase 6 — Review (review-agent)

### 6.1 Checklist Automático
- [ ] Segurança: nenhuma vulnerabilidade OWASP
- [ ] N+1: eager loading correto
- [ ] Autorização: policies em todos os endpoints
- [ ] TypeScript: sem `any`
- [ ] Testes: coverage não diminuiu
- [ ] Migrations: `down()` implementado

### 6.2 Self-Review
Antes de criar PR, revisar o diff com o review-agent:
```
Revisar o diff de [feature] usando review-agent com foco em:
1. Segurança da API
2. Performance de queries
3. Cobertura de testes
```

---

## Fase 7 — Deploy

### 7.1 Preparar PR
- Branch: `feature/nome-da-feature`
- Título descritivo com contexto
- Descrição com: o quê, por quê, como testar, screenshots se UI

### 7.2 CI/CD
```bash
# CI executa automaticamente ao abrir PR:
# ✓ php artisan test --parallel --coverage-min=80
# ✓ npm run type-check
# ✓ npm run lint
# ✓ npm run test
```

### 7.3 Deploy para Staging
```bash
# Após merge na main:
make deploy
# Verificar em staging antes de promover para produção
```

---

## Tempo Estimado por Fase
| Fase | Feature Simples | Feature Média | Feature Complexa |
|------|----------------|--------------|-----------------|
| Planejamento | 10 min | 20 min | 45 min |
| Database | 15 min | 30 min | 60 min |
| Backend | 30 min | 90 min | 180 min |
| Testes Backend | 30 min | 60 min | 90 min |
| Frontend | 45 min | 120 min | 240 min |
| Review + Fix | 15 min | 30 min | 60 min |
| **Total** | **2.5h** | **5.5h** | **12h** |
