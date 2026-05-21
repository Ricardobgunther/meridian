# Contexto: Stack do Projeto

## Visão Geral
Aplicação SaaS moderna com backend Laravel desacoplado do frontend Next.js,
banco de dados Supabase (PostgreSQL) e infraestrutura Docker.

## Versões Exatas

```
Backend:
  PHP:        8.3
  Laravel:    11.x
  Sanctum:    3.x
  Horizon:    5.x
  Telescope:  5.x (somente dev)

Frontend:
  Node.js:    20 LTS
  Next.js:    14.x (App Router)
  React:      18.x
  TypeScript: 5.x
  Tailwind:   3.x

Banco de Dados:
  PostgreSQL: 15 (via Supabase)
  Supabase:   2.x (JS client)

Cache/Queue:
  Redis:      7.x
  Queue:      Redis driver

Infraestrutura:
  Docker:     24.x
  Compose:    V2
  Nginx:      1.25
```

## Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
│                    (Browser / Mobile)                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS
    ┌──────────────▼──────────────┐
    │       Nginx (port 80/443)   │  ← reverse proxy, SSL termination
    └──────┬──────────────────────┘
           │                      │
    ┌──────▼────────┐    ┌────────▼────────────────────┐
    │  Next.js      │    │  Laravel API                 │
    │  (port 3000)  │    │  (PHP-FPM, port 9000)        │
    │               │    │                              │
    │  Server Side: │    │  Controllers                 │
    │  - SSR/SSG    │    │  Services                    │
    │  - Auth check │    │  Policies                    │
    │               │    │  Resources                   │
    └──────┬────────┘    └──────┬───────────────────────┘
           │                    │
           └────────┬───────────┘
                    │
    ┌───────────────▼───────────────────────────┐
    │              Supabase                      │
    │                                            │
    │  PostgreSQL 15 (banco principal)           │
    │  Auth (JWT tokens)                         │
    │  Storage (arquivos)                        │
    │  Realtime (websocket)                      │
    └────────────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │    Redis     │  ← cache + queues
    └─────────────┘
```

## Fluxo de Autenticação

```
1. Usuário faz login via Next.js (Supabase Auth)
2. Supabase retorna JWT token
3. Token armazenado em cookie httpOnly (via @supabase/ssr)
4. Next.js middleware verifica token em todas as rotas protegidas
5. Requests para Laravel API incluem token no header Authorization
6. Laravel verifica token via Sanctum (ou valida JWT do Supabase diretamente)
7. Usuário autenticado disponível via $request->user()
```

## Convenções de Nomenclatura

```
Banco (PostgreSQL):
  Tabelas:     snake_case plural   (invoice_items)
  Colunas:     snake_case          (user_id, created_at)
  Índices:     idx_{tabela}_{col}  (idx_invoices_user_id)
  Policies:    {tabela}_{op}_{ator} (invoices_select_owner)

Laravel:
  Models:      PascalCase singular (InvoiceItem)
  Controllers: PascalCase + Controller (InvoiceController)
  Services:    PascalCase + Service (InvoiceService)
  Events:      PascalCase past tense (InvoiceCreated)
  Jobs:        PascalCase imperative (SendInvoiceEmail)
  Enums:       PascalCase (InvoiceStatus)

TypeScript/React:
  Componentes: PascalCase (InvoiceCard)
  Hooks:       camelCase com use- prefix (useInvoices)
  Types:       PascalCase (Invoice, CreateInvoicePayload)
  Utilitários: camelCase (formatCurrency, parseDate)
  Arquivos:    kebab-case (invoice-card.tsx, use-invoices.ts)

API Routes:
  Versionamento: /api/v1/
  Recursos:      plural kebab-case (/api/v1/invoice-items)
  Verbos HTTP:   REST semântico (GET/POST/PUT/PATCH/DELETE)
```

## Variáveis de Ambiente por Ambiente

```bash
# .env (local)
APP_ENV=local
APP_DEBUG=true
LOG_LEVEL=debug

# .env.staging
APP_ENV=staging
APP_DEBUG=false
LOG_LEVEL=info

# .env.production
APP_ENV=production
APP_DEBUG=false
LOG_LEVEL=warning
OPCACHE_VALIDATE_TIMESTAMPS=0
```

## Portas de Desenvolvimento

```
80    → Nginx (proxying para app e frontend)
3000  → Next.js dev server (hot reload)
9000  → PHP-FPM (interno, não exposto)
6379  → Redis (interno)
5432  → PostgreSQL Supabase (remoto)
8888  → Laravel Telescope (dev only)
```

## Comandos Rápidos

```bash
# Ambiente
make up                              # iniciar tudo
make down                            # parar tudo
make shell                           # shell no container PHP
make logs                            # logs do app

# Laravel
make artisan cmd="migrate"           # php artisan migrate
make artisan cmd="tinker"            # REPL interativo
make artisan cmd="route:list"        # listar rotas

# Testes
make test                            # todos os testes
make test-coverage                   # com cobertura

# Frontend
docker compose exec frontend npm run dev    # dev server
docker compose exec frontend npm run build  # build produção
docker compose exec frontend npm run test   # testes Vitest
```
