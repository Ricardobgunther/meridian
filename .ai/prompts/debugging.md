# Prompt: Debugging

## Uso
Use quando encontrar um bug e precisar de ajuda para diagnosticar. Quanto mais contexto, melhor.

---

## Prompt de Debugging Completo

```
Você é o [backend-agent / frontend-agent / database-agent — o mais relevante para o contexto].

Estou investigando um bug. Ajude-me a diagnosticar e corrigir.

## Ambiente
- Laravel 11 + PHP 8.3 / Next.js 14 + TypeScript [escolher o relevante]
- Banco: Supabase (PostgreSQL 15)
- Ambiente onde ocorre: [local / staging / produção]

## Comportamento esperado
[O que deveria acontecer]
Exemplo: "Ao enviar POST /api/v1/invoices com itens válidos, deveria retornar 201 com a fatura criada."

## Comportamento atual
[O que está acontecendo de fato]
Exemplo: "Retorna 500 Internal Server Error sem mensagem de erro útil."

## Passos para reproduzir
1. [passo 1]
2. [passo 2]
3. [passo 3]

## Logs de erro
[Colar o stack trace completo]
Exemplo:
```
[2026-05-19 15:23:41] local.ERROR: Division by zero {"exception":"[object] (DivisionByZeroError(code: 0):
Division by zero at /var/www/html/app/Services/InvoiceService.php:87)
#0 /var/www/html/app/Http/Controllers/Api/V1/InvoiceController.php:34: App\Services\InvoiceService->create()
..."}
```

## Código suspeito
[Colar o trecho de código onde o erro ocorre]

## O que já tentei
- [tentativa 1]
- [tentativa 2]

Por favor:
1. Identifique a causa raiz
2. Explique por que ocorre
3. Forneça a correção
4. Sugira um teste que previna regressão
```

---

## Prompt Rápido (bug simples)

```
Bug: [descrição em 1 linha]

Erro: [mensagem de erro ou comportamento incorreto]

Código:
[colar código relevante]

Stack: Laravel 11 + PHP 8.3

O que está errado e como corrigir?
```

---

## Prompt para Bug de N+1

```
Você é o database-agent.

Detectei queries N+1 no log:
[colar o query log ou saída do Telescope]

Código que gera o problema:
[colar código]

Como eliminar o N+1 mantendo o mesmo comportamento?
Preciso da versão com eager loading correto e, se necessário,
o índice PostgreSQL para a coluna relacionada.
```

---

## Prompt para Bug de Estado no Frontend

```
Você é o frontend-agent.

Bug de estado no React:

Comportamento esperado: [o quê]
Comportamento atual: [o quê]

Componente com problema:
[colar código do componente]

Hook relacionado:
[colar hook se relevante]

Erros no console:
[colar erros]

Network tab — request/response:
[colar se relevante]

Possíveis causas que já eliminei:
- [o que já tentei]

Qual é o problema e como corrigir?
```

---

## Prompt para Bug de RLS / Permissão

```
Você é o database-agent + review-agent.

Bug de permissão no Supabase:

Comportamento esperado: usuário autenticado consegue [ação] em [recurso]
Comportamento atual: retorna [403 / vazio / erro RLS]

Tabela afetada: [nome_da_tabela]

Políticas RLS atuais:
[colar as policies da tabela]

Query sendo executada:
[colar a query ou código Supabase JS]

Auth context:
- Usuário autenticado: [sim/não]
- Token JWT: [verificado/não verificado]
- Role: [authenticated/anon]

Diagnostique o problema nas policies e forneça a correção.
```

---

## Prompt para Performance Lenta

```
Você é o database-agent.

Endpoint lento: [método] [rota]
Tempo atual: [X]ms
Target: [Y]ms

Query problemática (do EXPLAIN ANALYZE):
[colar saída do EXPLAIN ANALYZE]

Schema relevante:
[colar definição das tabelas envolvidas]

Índices existentes:
[colar \d nome_da_tabela do psql]

Número aproximado de registros:
- [tabela1]: [N] registros
- [tabela2]: [N] registros

O que precisa de otimização?
Forneça: query otimizada + índices necessários + estimativa de melhoria.
```

---

## Comandos Úteis para Coletar Contexto

```bash
# Backend — obter stack trace completo
docker compose exec app tail -n 100 storage/logs/laravel.log

# Backend — log de queries
docker compose exec app php artisan tinker
>>> DB::enableQueryLog();
>>> // reproduzir a ação
>>> dd(DB::getQueryLog());

# Banco — EXPLAIN ANALYZE
docker compose exec app php artisan db:monitor
# ou via psql:
docker compose exec db psql -U postgres -d nome_do_banco -c "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ...sua query...
"

# Frontend — verificar requests
# Chrome DevTools → Network → XHR/Fetch
# Copiar response body do request com erro

# Frontend — React estado
# React DevTools → Components → selecionar componente → ver props/state
```
