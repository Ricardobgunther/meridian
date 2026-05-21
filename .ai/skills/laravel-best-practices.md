# Skill: Laravel Best Practices

## Quando Usar
Aplicar em qualquer trabalho com código PHP/Laravel — backend, APIs, jobs, eventos.

## Estrutura de Projeto — Camadas

```
Controller → FormRequest → Service → Repository/Model → Resource → Response
                                ↓
                           Events → Listeners → Jobs
```

## Services — Regras de Ouro

1. Um Service por agregado de domínio
2. Métodos mapeiam 1:1 com casos de uso (`createInvoice`, `sendReminder`, `cancelOrder`)
3. Sempre usar `DB::transaction()` para operações que modificam múltiplas tabelas
4. Disparar eventos APÓS o commit da transação
5. Retornar a entidade completa (com relacionamentos necessários)

```php
// PADRÃO — Service bem estruturado
class OrderService
{
    public function __construct(
        private readonly PaymentGateway $paymentGateway,
        private readonly InventoryService $inventoryService,
    ) {}

    public function place(array $data, User $user): Order
    {
        return DB::transaction(function () use ($data, $user) {
            // 1. Criar o pedido
            $order = Order::create([...$data, 'user_id' => $user->id]);

            // 2. Criar os itens
            $order->items()->createMany($data['items']);

            // 3. Reservar estoque
            $this->inventoryService->reserve($order->items);

            // 4. Processar pagamento
            $payment = $this->paymentGateway->charge($order, $data['payment']);
            $order->update(['payment_id' => $payment->id, 'status' => 'confirmed']);

            // 5. Carregar relacionamentos e disparar evento
            $order->load(['items.product', 'payment']);
            event(new OrderPlaced($order));

            return $order;
        });
    }
}
```

## Enums PHP 8.1+

```php
// Sempre usar Enums para valores fixos — nunca strings mágicas
enum InvoiceStatus: string
{
    case Draft    = 'draft';
    case Sent     = 'sent';
    case Paid     = 'paid';
    case Overdue  = 'overdue';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match($this) {
            self::Draft    => 'Rascunho',
            self::Sent     => 'Enviada',
            self::Paid     => 'Paga',
            self::Overdue  => 'Vencida',
            self::Cancelled => 'Cancelada',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Paid, self::Cancelled]);
    }
}

// Uso no model
protected $casts = [
    'status' => InvoiceStatus::class,
];

// Comparação segura
if ($invoice->status === InvoiceStatus::Paid) { ... }
```

## Form Requests — Validação Completa

```php
class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Política de autorização real — não apenas `return true`
        return $this->user()->can('create', Invoice::class);
    }

    public function rules(): array
    {
        return [
            'client_id'              => ['required', 'uuid', Rule::exists('clients', 'id')->where('user_id', $this->user()->id)],
            'due_date'               => ['required', 'date', 'after:today'],
            'items'                  => ['required', 'array', 'min:1', 'max:50'],
            'items.*.description'    => ['required', 'string', 'max:500'],
            'items.*.quantity'       => ['required', 'integer', 'min:1', 'max:9999'],
            'items.*.unit_price'     => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'notes'                  => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'client_id.exists'    => 'Cliente não encontrado ou não pertence a você.',
            'due_date.after'      => 'A data de vencimento deve ser futura.',
            'items.min'           => 'Adicione pelo menos um item à fatura.',
        ];
    }
}
```

## API Resources — Transformação Segura

```php
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'number'       => $this->number,
            'status'       => $this->status,            // retorna o Enum ou string
            'status_label' => $this->status->label(),   // label localizado
            'subtotal'     => (float) $this->subtotal,
            'tax_amount'   => (float) $this->tax_amount,
            'total_amount' => (float) $this->total_amount,
            'due_date'     => $this->due_date->toDateString(),
            'paid_at'      => $this->paid_at?->toISOString(),
            'is_overdue'   => $this->status === InvoiceStatus::Sent
                              && $this->due_date->isPast(),

            // Relacionamentos carregados sob demanda
            'client'  => new ClientResource($this->whenLoaded('client')),
            'items'   => InvoiceItemResource::collection($this->whenLoaded('items')),

            // Metadados de auditoria
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}
```

## Eloquent — Padrões de Query

```php
// Escopo local para queries reutilizáveis
class Invoice extends Model
{
    // Sempre definir fillable explicitamente
    protected $fillable = [
        'user_id', 'client_id', 'number', 'status',
        'due_date', 'notes', 'paid_at',
    ];

    protected $casts = [
        'status'   => InvoiceStatus::class,
        'due_date' => 'date',
        'paid_at'  => 'datetime',
    ];

    // Escopos semânticos
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('deleted_at');
    }

    public function scopeOverdue(Builder $query): void
    {
        $query->where('status', InvoiceStatus::Sent)
              ->where('due_date', '<', now());
    }

    public function scopeForUser(Builder $query, User $user): void
    {
        $query->where('user_id', $user->id);
    }

    // Relacionamentos completos
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('created_at');
    }
}

// Uso com escopos
$invoices = Invoice::forUser($user)->overdue()->with('client')->paginate(25);
```

## Jobs — Configuração Correta

```php
class ProcessPaymentWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries     = 3;
    public int $timeout   = 60;
    public int $backoff   = 30; // segundos entre tentativas

    public function __construct(
        private readonly string $paymentId,
        private readonly array $payload,
    ) {}

    public function handle(PaymentService $paymentService): void
    {
        $paymentService->processWebhook($this->paymentId, $this->payload);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('payment.webhook.failed', [
            'payment_id' => $this->paymentId,
            'error'      => $exception->getMessage(),
        ]);

        // Notificar time de suporte se crítico
        Notification::route('mail', config('mail.support_address'))
            ->notify(new PaymentWebhookFailedNotification($this->paymentId));
    }
}
```

## Logging Estruturado

```php
// CORRETO — logs estruturados com contexto
Log::info('invoice.sent', [
    'invoice_id' => $invoice->id,
    'user_id'    => $invoice->user_id,
    'client_id'  => $invoice->client_id,
    'amount'     => $invoice->total_amount,
]);

Log::error('payment.failed', [
    'invoice_id'  => $invoice->id,
    'gateway'     => 'stripe',
    'error_code'  => $e->getCode(),
    'message'     => $e->getMessage(),
    // NUNCA logar: card_number, cvv, tokens, passwords
]);
```

## Anti-Patterns Críticos

```php
// NUNCA:
Invoice::all()                        // sem limite, mata a memória
$request->all()                       // mass assignment inseguro
env('APP_KEY')                        // fora de config files
DB::statement("... {$userInput}")     // SQL injection
echo $exception->getMessage()         // vaza informações internas
return response()->json($model)       // expõe campos internos
```
