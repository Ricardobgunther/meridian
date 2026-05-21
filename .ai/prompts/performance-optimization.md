# Prompt: Performance Optimization

## Uso
Use para identificar e corrigir gargalos de performance em queries, APIs ou frontend.

---

## Prompt de Análise de Performance Completa

```
Você é o [database-agent / backend-agent / frontend-agent] com foco em performance.

Endpoint/página com problema de performance:
[identificar o que é lento]

Métricas atuais:
- Tempo de resposta: [X]ms (P50) / [Y]ms (P99)
- Número de queries SQL executadas: [N]
- Bundle size (se frontend): [X]kb
- Time to First Byte: [X]ms (se frontend)

Target:
- Tempo de resposta: < [X]ms
- Queries: < [N]
- Bundle: < [X]kb

## Backend — contexto
Código atual:
[colar controller/service/query]

Saída do EXPLAIN ANALYZE:
[colar resultado]

Número de registros nas tabelas:
- invoices: [N]
- invoice_items: [N]
- clients: [N]

Índices existentes:
[colar \d nome_da_tabela]

## Frontend — contexto
Bundle analysis (se disponível):
[colar saída do next build ou webpack-bundle-analyzer]

Componentes suspeitos:
[colar código]

Lighthouse score atual:
- Performance: [X]
- LCP: [X]s
- FID: [X]ms
- CLS: [X]

Identificar os 3 maiores ganhos de performance e fornecer:
1. O problema exato
2. A solução implementada
3. O ganho esperado em números
```

---

## Prompt para Otimizar Queries SQL

```
Você é o database-agent.

Query lenta (> [X]ms):
[colar query SQL]

Contexto de uso:
- Frequência: [X] req/min
- Dados: [N] registros na tabela principal
- Executa em: [controller / job / schedule]

Saída do EXPLAIN ANALYZE:
[colar saída completa]

Índices existentes:
[colar \d+ nome_da_tabela]

Analisar e fornecer:
1. Por que a query está lenta (Seq Scan? Sort sem índice? Hash Join caro?)
2. Índices a criar
3. Query reescrita se necessário (CTEs, subqueries, etc.)
4. Estimativa de melhoria após otimização

Banco: PostgreSQL 15 no Supabase.
```

---

## Prompt para Resolver N+1

```
Você é o backend-agent.

Detectei N+1 via Laravel Telescope:
[colar as queries repetidas do Telescope]

Código que gera o problema:
[colar código]

Este endpoint/job é chamado [X] vezes por dia com [N] registros típicos.

Fornecer:
1. Versão com eager loading correto
2. Se usar hasManyThrough ou morphTo: estratégia específica para esse caso
3. Se há dados que poderiam ser cacheados: sugestão de cache com TTL adequado
4. Quantas queries ficará após a otimização
```

---

## Prompt para Otimizar Bundle Frontend

```
Você é o frontend-agent.

Bundle size atual: [X]kb (gzipped)
Target: < [Y]kb

Análise do bundle (next build output ou webpack-bundle-analyzer):
[colar output]

Dependências suspeitas:
[listar bibliotecas grandes]

Páginas mais pesadas:
[listar páginas e seus tamanhos]

Estratégias a aplicar:
1. Dynamic imports para rotas pesadas
2. Substituir bibliotecas grandes por alternativas menores
3. Tree-shaking: verificar imports corretos
4. Lazy loading de componentes abaixo da dobra

Para cada otimização:
- Mostrar o código antes e depois
- Estimar redução de bundle
- Verificar que não quebra funcionalidade
```

---

## Prompt para Otimizar Renderização React

```
Você é o frontend-agent.

Componente com problema de re-renders excessivos:
[colar componente]

Evidência do problema:
[React DevTools Profiler screenshot ou descrição do comportamento]

Contexto:
- Quantos itens renderiza: [N]
- Frequência de atualização: [X vezes/segundo / a cada interação]
- Já usa memo: [sim/não]
- Estado externo (Zustand/TanStack): [descrever]

Analisar:
1. O que causa os re-renders desnecessários
2. Se React.memo é apropriado aqui (com justificativa)
3. Se useMemo/useCallback se justificam (com justificativa)
4. Se o estado está no lugar certo (colocar mais próximo de quem usa)

Fornecer versão otimizada com explicação do porquê de cada mudança.
Não adicionar otimizações prematuras — apenas as que têm impacto real.
```

---

## Prompt para Cache Strategy

```
Você é o backend-agent.

Implementar cache para queries/endpoints de alta leitura:

Endpoint: [GET /api/v1/dashboard/stats]
Frequência: [X] req/min
Dados: [relativamente estáticos / mudam a cada X minutos]
TTL adequado estimado: [N minutos]

Código atual (sem cache):
[colar código]

Implementar:
1. Cache com Redis usando tags para invalidação granular
2. Cache key que varia por usuário (ou globalmente, se for dado compartilhado)
3. Invalidação automática quando dados relevantes mudam (via Events/Observers)
4. Warm-up de cache em job agendado (se dados críticos)

Não cachear:
- Dados que mudam a cada request
- Dados de segurança (permissions, tokens)
- Dados muito específicos por usuário com escala pequena
```

---

## Checklist de Performance

```
Backend:
□ Nenhum N+1 nas rotas principais
□ Paginação em todas as listagens
□ Cache nos dados mais requisitados
□ Índices nas queries mais frequentes
□ Jobs para operações pesadas (PDFs, emails, relatórios)
□ PHP OPcache habilitado em produção

Frontend:
□ LCP < 2.5s
□ CLS < 0.1
□ Bundle inicial < 200kb gzipped
□ Imagens com next/image (lazy loading automático)
□ Fontes com next/font (sem FOUT)
□ Dynamic imports para rotas pesadas
□ Skeleton loaders (não spinners) para listas

Banco:
□ EXPLAIN ANALYZE nas 10 queries mais frequentes
□ Índices parciais para filtered queries
□ pg_stat_statements habilitado para monitoramento
□ Connection pooling configurado (PgBouncer ou Supabase pooler)
```
