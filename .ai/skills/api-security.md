# Skill: API Security

## Quando Usar
Em qualquer trabalho com endpoints Laravel, autenticação, dados de usuário ou integrações externas.

## Checklist de Segurança por Endpoint

### Endpoint Protegido — Template Mínimo
```php
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::apiResource('invoices', InvoiceController::class);
});
```

Todo endpoint deve ter:
1. **Autenticação** — `auth:sanctum`
2. **Rate limiting** — `throttle:N,M`
3. **Validação** — Form Request com `authorize()` real
4. **Autorização** — Policy verificada
5. **Resource** — retorno via API Resource (sem dados extras)

## Autenticação — Laravel Sanctum

```php
// Emitir token com abilities (escopo)
public function login(LoginRequest $request): JsonResponse
{
    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['As credenciais fornecidas estão incorretas.'],
        ]);
    }

    // Revogar tokens antigos da mesma origem (opcional, mas boa prática)
    $user->tokens()->where('name', 'web-login')->delete();

    $token = $user->createToken('web-login', ['read', 'write'], now()->addDays(30));

    return response()->json([
        'token'      => $token->plainTextToken,
        'expires_at' => $token->accessToken->expires_at,
        'user'       => new UserResource($user),
    ]);
}

// Verificar ability no controller
public function destroy(Invoice $invoice): JsonResponse
{
    abort_unless($request->user()->tokenCan('write'), 403);
    $this->authorize('delete', $invoice);
    // ...
}

// Logout — invalidar todos os tokens do dispositivo atual
public function logout(Request $request): JsonResponse
{
    $request->user()->currentAccessToken()->delete();
    return response()->json(['message' => 'Logged out']);
}
```

## Rate Limiting — Configuração

```php
// app/Providers/AppServiceProvider.php
RateLimiter::for('api', function (Request $request) {
    return $request->user()
        ? Limit::perMinute(60)->by($request->user()->id)
        : Limit::perMinute(10)->by($request->ip());
});

RateLimiter::for('login', function (Request $request) {
    return [
        Limit::perMinute(5)->by($request->ip()),           // por IP
        Limit::perMinute(10)->by($request->input('email')), // por email
    ];
});

RateLimiter::for('sensitive', function (Request $request) {
    return Limit::perHour(20)->by($request->user()?->id ?? $request->ip());
});

// Uso nas rotas
Route::middleware('throttle:login')->post('/auth/login', [AuthController::class, 'login']);
Route::middleware(['auth:sanctum', 'throttle:sensitive'])->group(function () {
    Route::post('/auth/change-password', ...);
    Route::post('/billing/checkout', ...);
});
```

## Políticas de Autorização — Padrão

```php
// app/Policies/InvoicePolicy.php
class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return true; // qualquer usuário autenticado pode listar suas invoices
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id;
    }

    public function create(User $user): bool
    {
        return $user->hasVerifiedEmail() && !$user->isSuspended();
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id
            && !$invoice->status->isTerminal();
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->id === $invoice->user_id
            && $invoice->status === InvoiceStatus::Draft;
    }
}
```

## Validação de Input — Defesas

```php
// Sanitização de strings (HTML/JS injection)
'name'  => ['required', 'string', 'max:255', 'strip_tags'],

// Arquivos — validação estrita de tipo
'document' => [
    'required',
    'file',
    'mimes:pdf,jpg,png',        // extensão + MIME type
    'max:10240',                 // 10MB em KB
    'mimetypes:application/pdf,image/jpeg,image/png', // MIME real do conteúdo
],

// IDs — sempre UUID, nunca integer exposto
'invoice_id' => ['required', 'uuid', 'exists:invoices,id'],

// Nunca permitir sobrescrever campos de sistema
// ERRADO: $request->validated() com user_id, created_at etc.
// CORRETO: merge manual após validação
$data = array_merge($request->validated(), [
    'user_id'    => $request->user()->id,
    'created_by' => $request->user()->id,
]);
```

## Headers de Segurança

```php
// app/Http/Middleware/SecurityHeaders.php
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);

    $response->headers->set('X-Content-Type-Options', 'nosniff');
    $response->headers->set('X-Frame-Options', 'DENY');
    $response->headers->set('X-XSS-Protection', '1; mode=block');
    $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // CSP para APIs (sem HTML)
    $response->headers->set('Content-Security-Policy', "default-src 'none'");

    // Remover header que revela tecnologia
    $response->headers->remove('X-Powered-By');

    return $response;
}
```

## CORS — Configuração Segura

```php
// config/cors.php
return [
    'paths'               => ['api/*'],
    'allowed_methods'     => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins'     => [env('FRONTEND_URL', 'http://localhost:3000')],
    'allowed_origins_patterns' => [],
    'allowed_headers'     => ['Content-Type', 'Authorization', 'X-Requested-With'],
    'exposed_headers'     => ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    'max_age'             => 86400,
    'supports_credentials' => true,
];
// NUNCA: 'allowed_origins' => ['*'] em produção
```

## Respostas de Erro — Sem Vazamento de Info

```php
// ERRADO — vaza implementação interna
return response()->json([
    'error'  => $exception->getMessage(),    // pode conter SQL, paths, etc.
    'trace'  => $exception->getTraceAsString(),
], 500);

// CORRETO — mensagem genérica + log interno
Log::error('invoice.processing_failed', [
    'invoice_id' => $invoiceId,
    'error'      => $exception->getMessage(),
    'trace'      => $exception->getTraceAsString(),
]);

return response()->json([
    'message' => 'Erro ao processar a fatura. Tente novamente.',
    'code'    => 'INVOICE_PROCESSING_ERROR',
], 500);
```

## Webhooks — Verificação de Assinatura

```php
// Verificar assinatura HMAC de webhooks externos (Stripe, etc.)
public function handle(Request $request): JsonResponse
{
    $signature = $request->header('X-Webhook-Signature');
    $payload   = $request->getContent();
    $secret    = config('services.stripe.webhook_secret');

    $expected  = 'sha256=' . hash_hmac('sha256', $payload, $secret);

    if (!hash_equals($expected, $signature)) {
        Log::warning('webhook.invalid_signature', ['ip' => $request->ip()]);
        return response()->json(['error' => 'Invalid signature'], 401);
    }

    // Processar webhook
    ProcessWebhook::dispatch(json_decode($payload, true));
    return response()->json(['received' => true]);
}
```

## Senhas e Dados Sensíveis

```php
// NUNCA logar senhas, tokens, CPF, cartão
// Usar $hidden no model
protected $hidden = ['password', 'remember_token', 'two_factor_secret'];

// Mascarar dados em logs quando necessário
$maskedCard = '****' . substr($cardNumber, -4);
Log::info('payment.attempted', ['card_last4' => $maskedCard]);

// Hash sempre com bcrypt (padrão Laravel) — nunca md5/sha1
$user->update(['password' => Hash::make($newPassword)]);

// Comparação segura de tokens (timing-safe)
if (!hash_equals($storedToken, $providedToken)) {
    throw new UnauthorizedException();
}
```

## Anti-Patterns de Segurança Críticos
```php
// NUNCA — SQL injection direto
DB::select("SELECT * FROM users WHERE email = '$email'");

// NUNCA — autorização por ID sem verificar ownership
$invoice = Invoice::find($request->id); // pode ser de outro user

// NUNCA — expor IDs sequenciais (usar UUID)
Route::get('/invoices/{id}', ...); // com integer ID = IDOR fácil

// NUNCA — seção admin sem verificação de role
Route::prefix('admin')->group(function () {
    // sem middleware de admin!
});

// NUNCA — secrets em .env commitados
STRIPE_SECRET_KEY=sk_live_...  // no .env.example use apenas o nome

// NUNCA — tokens em URLs
/api/export?token=abc123  // logar URLs = vazar token
```
