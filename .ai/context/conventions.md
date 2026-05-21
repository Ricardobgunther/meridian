# Convenções do Projeto

Padrões e convenções que todos os agentes devem seguir.

## Commit Messages

```
Formato: <tipo>(<escopo>): <descrição imperativa>

Tipos:
  feat:     nova feature
  fix:      correção de bug
  refactor: refatoração sem mudança de comportamento
  test:     adicionar/modificar testes
  docs:     documentação
  chore:    configuração, dependências, CI
  perf:     melhoria de performance

Exemplos:
  feat(invoices): add comment system to invoices
  fix(auth): resolve 500 on expired token refresh
  refactor(invoice-service): extract PDF generation to dedicated action
  test(invoice-api): add authorization test cases for comment endpoints
  perf(dashboard): eliminate N+1 in stats query

Regras:
- Descrição em inglês (para histórico internacional)
- Imperativo: "add" não "added" nem "adds"
- Sem ponto final
- Máximo 72 caracteres na primeira linha
- Corpo explicando "por que" se não for óbvio
```

## Branch Naming

```
feature/nome-curto-da-feature
fix/descricao-curta-do-bug
hotfix/descricao-critica
refactor/o-que-esta-sendo-refatorado
chore/o-que-esta-sendo-configurado

Exemplos:
  feature/invoice-comments
  fix/invoice-pdf-crash
  hotfix/rls-bypass-vulnerability
  refactor/extract-invoice-service
  chore/update-docker-php-83
```

## Code Style

### PHP
```php
// PSR-12 + Laravel conventions
// Formatar com: vendor/bin/pint

// Tipagem estrita em todos os arquivos
declare(strict_types=1);

// Return types sempre declarados
public function create(array $data): Invoice

// Named arguments em construtores longos
new Invoice(
    userId: $user->id,
    clientId: $client->id,
    status: InvoiceStatus::Draft,
);

// Sem comentários óbvios
// RUIM:
// Get the user's invoices
public function getInvoices(User $user): Collection { ... }

// BOM: nenhum comentário (o código é auto-explicativo)
public function getInvoices(User $user): Collection { ... }
```

### TypeScript
```typescript
// ESLint + Prettier
// Formatar com: npm run format

// Interfaces para objetos de domínio
interface Invoice {
  id: string;
  status: InvoiceStatus;
}

// Types para unions e utilitários
type InvoiceStatus = 'draft' | 'sent' | 'paid';
type CreateInvoicePayload = Omit<Invoice, 'id' | 'created_at'>;

// Funções com return type explícito quando não é óbvio
function formatCurrency(amount: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
}

// Async/await com error handling explícito
async function fetchInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').select().eq('id', id).single();
  if (error) throw new Error(`Failed to fetch invoice: ${error.message}`);
  return data;
}
```

## API Response Format

```json
// Sucesso — singular
{
  "data": { ... }
}

// Sucesso — lista
{
  "data": [ ... ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 25,
    "total": 120
  }
}

// Erro de validação (422)
{
  "message": "Os dados fornecidos são inválidos.",
  "errors": {
    "due_date": ["A data de vencimento deve ser futura."],
    "items": ["Adicione pelo menos um item à fatura."]
  }
}

// Erro genérico (4xx/5xx)
{
  "message": "Mensagem amigável para o usuário.",
  "code": "MACHINE_READABLE_CODE"
}
```

## Mensagens de Erro — Tom e Idioma

```
- Erros de validação para o usuário: português, amigável
- Logs internos: inglês, técnico, com contexto
- Mensagens de exception que chegam ao usuário: português, sem detalhes técnicos

ERRADO para usuário:
"SQLSTATE[23000]: Integrity constraint violation: duplicate key value"

CORRETO para usuário:
"Já existe uma fatura com este número. Por favor, use um número diferente."
```

## Tamanhos Máximos de Arquivo

```
PHP:
  Controller:   200 linhas (excluir docblocks)
  Service:      300 linhas
  Model:        150 linhas
  FormRequest:  100 linhas

TypeScript:
  Componente:   200 linhas (excluir imports)
  Hook:         100 linhas
  Página:       150 linhas

Se ultrapassar: extrair em arquivos menores.
```

## Testes — Cobertura Mínima

```
app/Services/:          90%
app/Http/Controllers/:  80%
app/Http/Requests/:     85%
app/Policies/:          90%
components/features/:   70%
```

## Segurança — Regras Inegociáveis

```
1. NUNCA commitar .env com valores reais
2. NUNCA expor stack trace ao usuário em produção
3. SEMPRE usar parameterized queries (Eloquent ou bindings)
4. SEMPRE validar e autorizar antes de agir
5. SEMPRE usar HTTPS (sem mixed content)
6. NUNCA logar dados pessoais ou financeiros
7. Dependências: atualizar patch versions semanalmente, minor mensalmente
```
