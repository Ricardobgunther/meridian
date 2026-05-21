# Workflow: Code Review Flow

## Visão Geral
Processo de revisão de código que combina análise automatizada com review-agent para garantir qualidade antes do merge.

---

## Preparação para Abrir PR (autor)

### Self-Review Obrigatório
Antes de abrir o PR, o próprio autor deve responder:

```
□ Eu li cada linha do diff?
□ Os testes cobrem os casos de erro (não só happy path)?
□ Existe algum TODO que deveria ser resolvido agora?
□ Removi todos os console.log e dd() de debug?
□ As migrations têm down() implementado?
□ Há dados sensíveis (tokens, CPFs) logados ou em resposta de API?
```

### Descrição do PR — Template
```markdown
## O que foi feito
[1-3 bullets descrevendo as mudanças]

## Por que foi feito desta forma
[Decisões de design não óbvias — se tudo for óbvio, pode omitir]

## Como testar
1. Fazer X
2. Verificar que Y acontece
3. Caso de erro: fazer Z e verificar que W aparece

## Screenshots (se mudança de UI)
[Antes] [Depois]

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] Sem N+1 queries
- [ ] Sem `any` em TypeScript
- [ ] Migrations com down()
```

---

## Fase 1 — Review Automatizado

### CI (automático ao abrir PR)
```yaml
# Executado em todos os PRs:
- php artisan test --parallel --coverage-min=80
- npm run type-check
- npm run lint
- npm run test

# Bloqueia merge se qualquer etapa falhar
```

### Review com review-agent
```
Prompt para rodar antes de solicitar review humano:

"Revisar o seguinte diff como review-agent:
[colar o diff ou indicar os arquivos modificados]

Foco em:
1. Vulnerabilidades de segurança
2. N+1 queries ou problemas de performance
3. Autorização incompleta
4. TypeScript sem tipagem adequada
5. Edge cases não tratados"
```

---

## Fase 2 — Review Humano

### Quem Revisa o Quê

| Tipo de Mudança | Revisor Primário | Revisor Secundário |
|----------------|-----------------|-------------------|
| Endpoint de API | backend-agent | review-agent (segurança) |
| Schema / Migration | database-agent | backend-agent |
| Componente de UI | frontend-agent | uiux-agent |
| Dockerfile / CI | devops-agent | — |
| Lógica de negócio crítica | backend-agent | review-agent |
| Feature completa (fullstack) | todos os agentes relevantes | — |

### SLA de Review
- **P0/Hotfix:** 30 minutos
- **Features:** 4 horas úteis
- **Refactor:** 1 dia útil
- **Docs/Config:** 2 dias úteis

---

## Fase 3 — Feedback e Resolução

### Categorias de Feedback
```
🚫 BLOQUEIO   — Problema crítico, não pode ser mergeado até corrigir
⚠️  AVISO     — Problema real mas não bloqueia, recomendado corrigir
💡 SUGESTÃO  — Melhoria opcional, autor decide
ℹ️  NOTA      — Informação, sem ação necessária
```

### Regras de Resolução
- **Bloqueio:** autor corrige e pede re-review do trecho específico
- **Aviso:** autor corrige ou documenta por que não corrigiu (no PR)
- **Sugestão:** autor responde "feito" ou "vou manter assim por X razão"
- Sem silêncio — toda thread deve ser respondida

### Re-Review
```
Após correções:
- Comentar no PR: "Corrigi todos os bloqueios. Pode re-revisar?"
- Re-reviewer olha APENAS o que mudou, não re-lê tudo
- Se correto: approva o thread específico
```

---

## Fase 4 — Merge

### Condições para Merge
```
✓ CI passando (todos os checks verdes)
✓ Todos os bloqueios resolvidos
✓ Pelo menos 1 aprovação (2 para mudanças críticas de segurança/auth)
✓ Branch atualizada com main (sem conflitos)
```

### Tipo de Merge
```bash
# Squash merge para features (histórico limpo na main)
# Merge commit para hotfixes (preservar contexto)
# NUNCA rebase em branches compartilhados
```

### Checklist Pós-Merge
```
□ Branch deletada
□ Issues relacionadas fechadas
□ Staging verificado após deploy automático
□ Documentação atualizada (se necessário)
```

---

## Exemplos de Feedback Construtivo

### Bloqueio — Segurança
```
🚫 BLOQUEIO — Linha 34

`Invoice::find($request->invoice_id)` não verifica se a invoice
pertence ao usuário autenticado. Um usuário pode acessar faturas de
outros usuários alterando o invoice_id.

Correção:
  $invoice = Invoice::where('id', $request->invoice_id)
                    ->where('user_id', $request->user()->id)
                    ->firstOrFail();

Ou usar route model binding com a policy correta.
```

### Aviso — Performance
```
⚠️ AVISO — Linha 67-73

O loop `foreach ($users as $user) { $user->invoices()->count() }` 
executa N queries (uma por usuário). Com 1000 usuários = 1001 queries.

Solução preferida:
  $invoiceCounts = Invoice::whereIn('user_id', $users->pluck('id'))
      ->groupBy('user_id')
      ->selectRaw('user_id, COUNT(*) as total')
      ->pluck('total', 'user_id');
```

### Sugestão — Clareza
```
💡 SUGESTÃO — Linha 12

`$data` é vago aqui — consideraria `$invoicePayload` ou `$invoiceData`
para comunicar melhor o que esse array contém. Não é obrigatório.
```

### Nota — Contexto
```
ℹ️ NOTA — Linhas 45-60

Esse padrão de cálculo de total está replicado em InvoiceService e
QuoteService. Não é um problema desta PR, mas vale criar um ValueObject
`Money` para centralizar isso no futuro.
```
