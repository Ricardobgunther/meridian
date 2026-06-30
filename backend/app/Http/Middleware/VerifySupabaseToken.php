<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\Auth\SupabaseTokenVerifier;
use App\Services\Auth\UserProvisioningService;
use Closure;
use DomainException;
use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;
use UnexpectedValueException;

/**
 * Validates Supabase-issued JWTs on incoming requests and lazy-provisions
 * the local user row (ADR-011).
 *
 * Expects an `Authorization: Bearer <token>` header. On success:
 *   - Decoded claims are attached as `supabase_user` (back-compat).
 *   - The local `User` model is attached as `current_user` and via
 *     `$request->setUserResolver(...)` so `$request->user()` works.
 */
class VerifySupabaseToken
{
    private const EXPECTED_AUDIENCE = 'authenticated';

    public function __construct(
        private readonly UserProvisioningService $userProvisioning,
        private readonly SupabaseTokenVerifier $tokenVerifier,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractBearerToken($request);

        if ($token === null) {
            return $this->unauthorized('Não autenticado.');
        }

        try {
            $claims = $this->tokenVerifier->decode($token);
        } catch (ExpiredException|SignatureInvalidException|BeforeValidException|UnexpectedValueException|DomainException $e) {
            Log::info('Supabase JWT rejected: signature or format invalid', ['ip' => $request->ip()]);

            return $this->unauthorized('Sessão expirada ou inválida.');
        } catch (RuntimeException $e) {
            // Misconfiguration (missing secret/URL) or an unreachable JWKS
            // endpoint — our problem, not the caller's. Log loudly but still
            // return the generic 401 so we never leak config details.
            Log::error('Supabase token verification unavailable.', [
                'message' => $e->getMessage(),
            ]);

            return $this->unauthorized('Sessão expirada ou inválida.');
        }

        // Require subject claim (Supabase user id).
        $subject = $claims->sub ?? null;

        if (! is_string($subject) || $subject === '') {
            Log::info('Supabase JWT rejected: missing sub', ['ip' => $request->ip()]);

            return $this->unauthorized('Sessão expirada ou inválida.');
        }

        // Require expiration claim — firebase/php-jwt only validates `exp`
        // when present, so we enforce its presence explicitly.
        $expiration = $claims->exp ?? null;

        if (! is_numeric($expiration)) {
            Log::info('Supabase JWT rejected: missing exp', ['ip' => $request->ip()]);

            return $this->unauthorized('Sessão expirada ou inválida.');
        }

        // Validate audience claim — Supabase issues `authenticated` for end users.
        $audience = $claims->aud ?? null;

        if (! is_string($audience) || $audience !== self::EXPECTED_AUDIENCE) {
            Log::info('Supabase JWT rejected: aud mismatch', ['ip' => $request->ip()]);

            return $this->unauthorized('Sessão expirada ou inválida.');
        }

        // Validate issuer claim — only when SUPABASE_URL is configured. Without
        // the URL we cannot derive the expected issuer; signature + aud still
        // guard the request, so we skip iss rather than failing open.
        $supabaseUrl = config('supabase.url');

        if (is_string($supabaseUrl) && $supabaseUrl !== '') {
            $expectedIssuer = rtrim($supabaseUrl, '/').'/auth/v1';
            $issuer = $claims->iss ?? null;

            if (! is_string($issuer) || $issuer !== $expectedIssuer) {
                Log::info('Supabase JWT rejected: iss mismatch', ['ip' => $request->ip()]);

                return $this->unauthorized('Sessão expirada ou inválida.');
            }
        } else {
            Log::warning('SUPABASE_URL not configured; skipping iss validation');
        }

        // Normalise claims to array for downstream consumers and for the
        // provisioning service (which is decoupled from firebase/php-jwt).
        /** @var array<string, mixed> $claimsArray */
        $claimsArray = json_decode((string) json_encode($claims), true);

        $request->attributes->set('supabase_user', $claimsArray);

        try {
            $user = $this->userProvisioning->provisionFromClaims($claimsArray);
        } catch (Throwable $e) {
            Log::error('user.provisioning_failed', [
                'user_id' => $subject,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return response()->json(
                ['error' => 'Erro ao provisionar usuário.'],
                Response::HTTP_INTERNAL_SERVER_ERROR,
            );
        }

        $request->setUserResolver(static fn () => $user);
        $request->attributes->set('current_user', $user);

        // Populate the auth guard too — `$this->authorize(...)` and the
        // Gate facade resolve the user from `Auth::user()`, not from the
        // request's user resolver. Without this call, Policy classes are
        // never invoked because the Gate sees a null user and short-
        // circuits to "unauthorized" before reaching the policy method.
        Auth::setUser($user);

        return $next($request);
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization');

        if (! is_string($header) || $header === '') {
            return null;
        }

        if (! str_starts_with($header, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }

    private function unauthorized(string $message): JsonResponse
    {
        return response()->json(['error' => $message], Response::HTTP_UNAUTHORIZED);
    }
}
