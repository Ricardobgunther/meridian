# Workflow: Bugfix Flow

## Visão Geral
Processo estruturado para diagnosticar, corrigir e verificar bugs — sem introduzir novos problemas.

## Classificação de Severidade

| Severidade | Impacto | Tempo de Resposta |
|-----------|---------|------------------|
| **P0 — Crítico** | Produção down, dados corrompidos, falha de segurança | Imediato (< 1h) |
| **P1 — Alto** | Feature principal quebrada para todos os usuários | < 4h |
| **P2 — Médio** | Feature parcialmente quebrada ou edge case | < 24h |
| **P3 — Baixo** | UI quebrada, texto errado, comportamento inesperado menor | Próximo sprint |

---

## Fase 1 — Reprodução

**Objetivo: confirmar o bug antes de qualquer código**

### 1.1 Informações Necessárias
```
□ Ambiente onde ocorre: local / staging / produção
□ Passos exatos para reproduzir
□ Comportamento esperado vs. comportamento atual
□ User ID ou dados específicos (se relevante)
□ Timestamp do erro
□ Logs de erro (se disponíveis)
```

### 1.2 Reproduzir Localmente
```bash
# Clonar estado do banco de produção (se necessário)
docker compose exec app php artisan db:seed --class=BugReproductionSeeder

# Verificar logs
docker compose logs -f app
docker compose exec app tail -f storage/logs/laravel.log

# Checar erros recentes
docker compose exec app php artisan telescope:prune --hours=1
```

### 1.3 Escrever Teste que Reproduz o Bug
**ANTES de qualquer correção**, escrever o teste que falha:

```php
// tests/Feature/Api/V1/InvoiceTest.php
it('FAILING: returns 500 when invoice has no items', function () {
    // Esse teste DEVE FALHAR agora — vamos fazer passar com a correção

    $invoice = Invoice::factory()->create(); // sem items!

    actingAs($invoice->user)
        ->getJson("/api/v1/invoices/{$invoice->id}/pdf")
        ->assertOk() // atualmente retorna 500
        ->assertHeader('Content-Type', 'application/pdf');
});
```

```bash
docker compose exec app php artisan test --filter="returns 500 when invoice has no items"
# Deve falhar — confirma que reproduzimos o bug
```

---

## Fase 2 — Diagnóstico

**Responsável: agente especializado na camada do bug**

### Localização por Tipo de Bug

```bash
# Bug de backend (500, 422 inesperado, dados errados)
→ backend-agent
→ Verificar: logs, stack trace, lógica do Service

# Bug de banco (dados inconsistentes, query errada)
→ database-agent
→ Verificar: EXPLAIN ANALYZE, N+1, índices

# Bug de frontend (UI quebrada, estado errado, crash)
→ frontend-agent
→ Verificar: console.error, network tab, React DevTools

# Bug de permissão (403 inesperado, acesso indevido)
→ review-agent + backend-agent
→ Verificar: policies, middleware, RLS

# Bug de ambiente (funciona local, falha em staging/prod)
→ devops-agent
→ Verificar: variáveis de ambiente, versões, configuração
```

### Ferramentas de Diagnóstico

```bash
# Backend — inspecionar estado
docker compose exec app php artisan tinker
>>> $invoice = Invoice::find('uuid-aqui');
>>> $invoice->items()->count();
>>> $invoice->toArray();

# Queries em execução
>>> DB::enableQueryLog();
>>> // executar operação
>>> DB::getQueryLog();

# Frontend — reproduzir em isolamento
# Adicionar temporariamente:
console.log('state:', invoices);
console.error('error:', error);

# Banco — analisar query problemática
docker compose exec app php artisan db:monitor
```

---

## Fase 3 — Correção

### 3.1 Branch Correta
```bash
git checkout -b fix/invoice-pdf-crash-when-no-items
# Para P0: trabalhar direto em hotfix branch
git checkout -b hotfix/security-rls-bypass
```

### 3.2 Correção Mínima
**Regra: corrigir apenas o bug. Não refatorar o entorno.**

```php
// ERRADO — corrigir o bug E refatorar tudo ao redor
class InvoicePdfService
{
    // Refatorou completamente o serviço enquanto corrigia um bug
    public function generate(Invoice $invoice): string
    {
        $this->validateInvoice($invoice); // nova abstração desnecessária
        $this->prepareData($invoice);    // nova abstração desnecessária
        // ...
    }
}

// CORRETO — correção cirúrgica
public function generatePdf(Invoice $invoice): string
{
    // BUGFIX: invoice sem items causava divisão por zero no cálculo de totais
    if ($invoice->items->isEmpty()) {
        throw new InvalidInvoiceException('Cannot generate PDF for invoice without items');
    }

    // resto do código sem alteração
}
```

### 3.3 Verificar Regressões
```bash
# Rodar toda a suite de testes
docker compose exec app php artisan test

# Rodar testes relacionados ao módulo afetado
docker compose exec app php artisan test --filter=Invoice
docker compose exec app php artisan test --filter=Pdf
```

---

## Fase 4 — Verificação

### 4.1 Teste Original Passando
```bash
docker compose exec app php artisan test --filter="returns 500 when invoice has no items"
# DEVE PASSAR agora
```

### 4.2 Nenhuma Regressão
```bash
docker compose exec app php artisan test --parallel
# Todos os testes devem passar
```

### 4.3 Verificação Manual
- Testar o cenário exato do bug manualmente
- Testar variações do cenário (invoice com 1 item, com 10 itens, etc.)
- Verificar edge cases relacionados

---

## Fase 5 — Deploy (P0/P1)

```bash
# Hotfix vai direto para produção, não pelo fluxo normal de feature

# 1. PR para main com título: "fix: [P0] invoice PDF crash when no items"
# 2. Revisão expedita por pelo menos 1 pessoa
# 3. Deploy imediato após merge

# Comunicação interna durante P0:
# "Identificado bug em geração de PDF para faturas sem itens.
#  Correção aplicada em [timestamp]. Monitorando."
```

### Verificação Pós-Deploy
```bash
# Verificar logs em produção por 30 minutos
# Confirmar que o erro não aparece mais

# Para P0: criar post-mortem no prazo de 24h
```

---

## Template de Post-Mortem (P0/P1)

```markdown
## Post-Mortem: [Título do Bug]
**Data:** YYYY-MM-DD
**Severidade:** P0/P1
**Duração do Impacto:** X horas Y minutos

### O que aconteceu
[Descrição factual do incidente]

### Linha do Tempo
- HH:MM — Bug detectado por [quem/como]
- HH:MM — Início da investigação
- HH:MM — Root cause identificado
- HH:MM — Fix deployado
- HH:MM — Confirmação de resolução

### Root Cause
[Causa raiz técnica e por que aconteceu]

### Impacto
- X usuários afetados
- Y% das requisições falhando
- [Dados perdidos? Sim/Não]

### Correção Aplicada
[O que foi feito]

### Ações Preventivas
- [ ] [Ação 1] — Responsável: [nome] — Prazo: [data]
- [ ] [Ação 2] — Responsável: [nome] — Prazo: [data]
```
