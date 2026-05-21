# Prompt: Criar Feature

## Uso
Copie e adapte este prompt ao iniciar qualquer nova feature. Ajuste as seções entre `[colchetes]`.

---

## Prompt Template

```
Você é o [backend-agent / frontend-agent / database-agent — escolher o mais relevante].

Stack do projeto:
- Backend: Laravel 11, PHP 8.3, API RESTful
- Frontend: Next.js 14 (App Router), TypeScript 5, Tailwind CSS
- Banco: Supabase (PostgreSQL 15) com RLS
- Auth: Supabase Auth + Laravel Sanctum

Contexto da feature:
[Descreva a feature em 2-3 frases. O que ela faz, para quem serve, qual problema resolve.]

Exemplo de contexto:
"Criar um sistema de comentários em faturas. Usuários podem adicionar notas internas
que não são visíveis para o cliente, apenas para a equipe do usuário."

Tarefa:
[Descreva exatamente o que deve ser implementado]

Exemplo de tarefa:
"Implementar o endpoint POST /api/v1/invoices/{invoice}/comments que:
1. Aceita body: { content: string (max 1000 chars), is_internal: boolean }
2. Verifica que o usuário autenticado é owner da invoice
3. Salva o comment associado à invoice e ao usuário
4. Retorna o comment criado com dados do autor"

Restrições:
- Seguir padrões em .ai/skills/laravel-best-practices.md
- Autorização via InvoicePolicy
- Usar CommentResource para resposta
- Incluir testes unitários do CommentService e feature test do endpoint
- Migrations com down() implementado

Entregáveis esperados:
1. Migration: create_invoice_comments_table
2. Model: InvoiceComment com $fillable, $casts, relacionamentos
3. Policy: InvoiceCommentPolicy ou extensão de InvoicePolicy
4. FormRequest: StoreInvoiceCommentRequest
5. Resource: InvoiceCommentResource
6. Service: InvoiceCommentService->create()
7. Controller: InvoiceCommentController->store()
8. Rota em routes/api.php
9. Testes: Feature/InvoiceCommentTest.php + Unit/InvoiceCommentServiceTest.php

Não incluir:
- Paginação (é simples, apenas 10-20 comentários por fatura)
- Edição de comentários (fora do escopo desta feature)
- Notificações (próxima feature)
```

---

## Variações por Agente

### Para frontend-agent
```
Você é o frontend-agent.

Stack: Next.js 14 (App Router), TypeScript 5, Tailwind CSS, TanStack Query, Supabase JS.

API disponível:
GET  /api/v1/invoices/{id}/comments → CommentResource[]
POST /api/v1/invoices/{id}/comments → body: { content, is_internal }

Criar:
1. Hook useInvoiceComments(invoiceId) — lista com TanStack Query
2. Hook useAddComment() — mutação com optimistic update
3. Componente CommentList — renderiza lista de comentários
4. Componente AddCommentForm — form com React Hook Form + Zod
5. Componente CommentItem — um comentário com avatar, data e conteúdo

Design:
- Usar shadcn/ui para o form
- Avatar do usuário com iniciais (sem imagem real)
- Timestamps em formato relativo ("há 2 horas")
- Comentários internos com badge "Interno" e fundo amarelo suave
- Empty state: "Nenhum comentário ainda. Seja o primeiro."

Acessibilidade:
- Form com labels associados
- Textarea com aria-label
- Lista com role="feed" e aria-label="Comentários da fatura"
```

### Para database-agent
```
Você é o database-agent.

Criar schema para comentários de faturas:

Tabela: invoice_comments
- id: UUID (PK)
- invoice_id: UUID (FK → invoices, cascade delete)
- user_id: UUID (FK → users, restrict delete)
- content: TEXT (max 1000 chars via constraint)
- is_internal: BOOLEAN DEFAULT true
- deleted_at: TIMESTAMPTZ (soft delete)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

RLS Policies:
- SELECT: user vê apenas comments de suas invoices
- INSERT: authenticated users que são owner da invoice
- UPDATE: apenas o próprio autor pode editar (não implementado ainda)
- DELETE: apenas o owner da invoice pode soft-delete

Índices necessários:
- invoice_id (para buscar comments de uma invoice)
- user_id (para buscar comments de um usuário)
- created_at (para ordenação)
```

---

## Checklist Pós-Feature

```
□ php artisan test --filter=Comment passando
□ php artisan route:list mostra as novas rotas
□ Endpoint testado manualmente com curl ou Postman/Insomnia
□ TypeScript sem erros: npm run type-check
□ UI renderiza corretamente no browser
□ Empty state funciona
□ Estados de loading e erro implementados
□ Sem console.error no browser
□ PR aberto com descrição completa
```
