# Skill: Testing Rules

## Quando Usar
Ao escrever, revisar ou debugar testes em qualquer camada da aplicação.

## Regras Fundamentais

### 1. Testar Comportamento, Não Implementação
```php
// ERRADO — testa implementação interna
it('calls PaymentGateway::charge once', function () {
    $mock = Mockery::mock(PaymentGateway::class);
    $mock->shouldReceive('charge')->once();
    // ...
});

// CORRETO — testa o resultado observável
it('creates a paid order when payment succeeds', function () {
    $order = $this->orderService->place($data, $user);

    expect($order->status)->toBe(OrderStatus::Confirmed);
    $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'captured']);
});
```

### 2. Testes Independentes — Sem Estado Compartilhado
```php
// CORRETO — cada teste começa com banco limpo (RefreshDatabase)
uses(RefreshDatabase::class)->in('Feature');

// Cada it() é independente
it('creates invoice', function () {
    $user = User::factory()->create();       // cria no banco de teste
    // ...
});                                          // banco volta ao estado inicial

it('lists invoices', function () {
    $user = User::factory()->create();       // não depende do teste anterior
    Invoice::factory()->for($user)->count(3)->create();
    // ...
});
```

### 3. Um Assert por Comportamento (não por test)
```php
// CORRETO — múltiplos asserts sobre o MESMO comportamento
it('returns invoice with all required fields', function () {
    $response = actingAs($user)->getJson("/api/v1/invoices/{$invoice->id}");

    $response->assertOk();
    // Todos os asserts abaixo verificam a MESMA coisa: a estrutura da resposta
    $response->assertJsonPath('data.id', $invoice->id);
    $response->assertJsonPath('data.status', 'draft');
    $response->assertJsonPath('data.client.name', $client->name);
    $response->assertJsonMissingPath('data.user.password_hash');
});

// ERRADO — múltiplos comportamentos em um único it()
it('invoice test', function () {
    // Testa criação
    $response = actingAs($user)->postJson('/api/v1/invoices', $data);
    $response->assertCreated();

    // Testa listagem (comportamento diferente!)
    $list = actingAs($user)->getJson('/api/v1/invoices');
    $list->assertOk();

    // Testa delete (comportamento diferente!)
    actingAs($user)->deleteJson("/api/v1/invoices/{$response->json('data.id')}");
});
```

### 4. Factories com Estados Semânticos

```php
// ERRADO — dados mágicos espalhados pelos testes
$invoice = Invoice::factory()->create([
    'status'   => 'sent',
    'due_date' => Carbon::now()->subDays(5),
]);

// CORRETO — estado nomeado e reutilizável
$invoice = Invoice::factory()->overdue()->create();
// E no InvoiceFactory:
// public function overdue(): static { ... }
```

### 5. Arrange → Act → Assert (AAA)

```php
it('sends reminder email when invoice is overdue', function () {
    // ARRANGE — preparar dados
    Mail::fake();
    $user    = User::factory()->create();
    $invoice = Invoice::factory()->for($user)->overdue()->create();

    // ACT — executar ação
    $this->invoiceService->sendOverdueReminders();

    // ASSERT — verificar resultado
    Mail::assertSent(InvoiceReminderMail::class, function ($mail) use ($invoice) {
        return $mail->hasTo($invoice->client->email)
            && $mail->invoice->is($invoice);
    });
});
```

## Mocking — Quando e Como

```php
// USAR mock para: serviços externos, APIs de terceiros, emails, SMS, pagamentos
Mail::fake();
Http::fake(['api.stripe.com/*' => Http::response(['id' => 'pi_test'], 200)]);
Storage::fake('s3');
Event::fake([InvoiceCreated::class]);
Queue::fake();
Notification::fake();

// NÃO USAR mock para: Services internos, Models, DB (use RefreshDatabase)
// Conectar ao banco real em testes = confidence real
```

## Datasets — Testes Parametrizados (Pest)

```php
it('rejects invoice creation with invalid status transition', function (string $fromStatus, string $toStatus) {
    $invoice = Invoice::factory()->create(['status' => $fromStatus]);

    $response = actingAs($invoice->user)
        ->patchJson("/api/v1/invoices/{$invoice->id}", ['status' => $toStatus]);

    $response->assertUnprocessable();
})->with([
    'paid to draft'       => ['paid', 'draft'],
    'cancelled to sent'   => ['cancelled', 'sent'],
    'paid to overdue'     => ['paid', 'overdue'],
]);
```

## Testes de Componente React — Boas Práticas

```typescript
// test-utils.tsx — wrapper padrão para providers
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

// Usar getByRole (acessível) antes de getByTestId
screen.getByRole('button', { name: /criar fatura/i })   // PREFERIDO
screen.getByLabelText(/email/i)                          // PREFERIDO
screen.getByTestId('submit-btn')                         // ÚLTIMO recurso

// Queries assíncronas com findBy (espera o elemento aparecer)
const errorMsg = await screen.findByText(/erro ao carregar/i);

// Interações com userEvent (não fireEvent)
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'texto');
await user.selectOptions(select, 'option-value');
```

## Coverage — Targets por Camada

```
Services:        > 90%  — lógica de negócio crítica
Controllers:     > 80%  — endpoints da API
Form Requests:   > 85%  — validação e autorização
Policies:        > 90%  — autorização
Components React: > 70%  — componentes de feature
Utils/Helpers:   > 95%  — funções puras
```

## Nomenclatura de Testes

```php
// Padrão: verbo + contexto + resultado esperado
it('creates invoice when data is valid')
it('returns 422 when due_date is in the past')
it('returns 403 when user does not own the client')
it('sends overdue reminder email for each overdue invoice')
it('does not send email when invoice is already paid')
it('rolls back transaction when payment gateway fails')
```

## Anti-Patterns

```php
// NUNCA — teste sem assertion
it('processes invoice', function () {
    $this->invoiceService->process($invoice);
    // sem expect/assert!
});

// NUNCA — sleep() em testes
it('sends email after 5 seconds', function () {
    sleep(5); // teste lento e frágil
    // usar: $this->travel(5)->seconds();
});

// NUNCA — dados hardcoded de produção em testes
$user = User::factory()->create(['id' => 'prod-uuid-aqui']);

// NUNCA — testar código do framework (testes desnecessários)
it('creates a model', function () {
    $invoice = Invoice::create([...]);
    $this->assertInstanceOf(Invoice::class, $invoice);
});

// NUNCA — ordem de teste implícita
// Cada it() deve ser independente e executar em qualquer ordem
```
