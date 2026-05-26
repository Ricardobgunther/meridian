<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use UnexpectedValueException;

/**
 * Validates Supabase-issued JWTs on incoming requests.
 *
 * Expects an `Authorization: Bearer <token>` header. On success, decoded
 * claims are attached to the request under the `supabase_user` attribute
 * so downstream controllers can read them without re-parsing the token.
 */
class VerifySupabaseToken
{
    private const EXPECTED_AUDIENCE = 'authenticated';

    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractBearerToken($request);

        if ($token === null) {
            return $this->unauthorized('Não autenticado.');
        }

        $secret = config('supabase.jwt_secret');

        if (! is_string($secret) || $secret === '') {
            Log::error('SUPABASE_JWT_SECRET is not configured.');

            return $this->unauthorized('Sessão expirada ou inválida.');
        }

        try {
            $claims = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (ExpiredException|SignatureInvalidException|BeforeValidException|UnexpectedValueException $e) {
            Log::info('Supabase JWT rejected: signature or format invalid', ['ip' => $request->ip()]);

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

        // Normalize to array for easier consumption downstream.
        $request->attributes->set('supabase_user', json_decode((string) json_encode($claims), true));

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
