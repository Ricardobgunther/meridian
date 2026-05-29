<?php

declare(strict_types=1);

namespace App\Services\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use stdClass;
use UnexpectedValueException;

/**
 * Verifies Supabase-issued access tokens, supporting BOTH signing schemes a
 * project may use (ADR-007):
 *
 *  - HS256: the legacy shared "JWT Secret" (still used for the anon/service
 *    API keys and projects that never migrated).
 *  - ES256 / RS256: the current asymmetric "JWT signing keys". User access
 *    tokens (e.g. after a Google sign-in) are signed with these. The public
 *    keys are published at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
 *
 * The signing algorithm is read from the (unverified) token header and the
 * matching key material is selected from there — never from attacker input
 * beyond `alg`/`kid`. Asymmetric keys are fetched once and cached; a `kid`
 * miss (key rotation) busts the cache and refetches a single time.
 */
class SupabaseTokenVerifier
{
    /** Allowed signing algorithms — guards against `alg: none` and friends. */
    private const ALLOWED_ALGS = ['HS256', 'ES256', 'RS256'];

    /** JWKS cache lifetime. Supabase rotates keys rarely; 1h is conservative. */
    private const JWKS_CACHE_TTL = 3600;

    /** Hard cap on the JWKS HTTP fetch so a slow endpoint never hangs a request. */
    private const HTTP_TIMEOUT = 5;

    /** Small leeway (seconds) to tolerate minor clock skew between services. */
    private const LEEWAY = 60;

    /**
     * Decode and signature-verify a token, returning its claims.
     *
     * @throws \Firebase\JWT\ExpiredException
     * @throws \Firebase\JWT\SignatureInvalidException
     * @throws \Firebase\JWT\BeforeValidException
     * @throws UnexpectedValueException  Malformed token or unsupported alg.
     * @throws RuntimeException          Verifier is misconfigured for this alg.
     */
    public function decode(string $token): stdClass
    {
        JWT::$leeway = self::LEEWAY;

        $alg = $this->headerAlg($token);

        return match ($alg) {
            'HS256' => JWT::decode($token, new Key($this->hmacSecret(), 'HS256')),
            'ES256', 'RS256' => $this->decodeWithJwks($token),
            // Unreachable: headerAlg() already rejects anything outside the
            // allow-list, but match() must be exhaustive.
            default => throw new UnexpectedValueException("Unsupported JWT alg: {$alg}"),
        };
    }

    /**
     * Read the `alg` from the token header without verifying the signature.
     * Rejecting unknown algorithms here keeps `decode()` from ever picking a
     * key for an algorithm we don't explicitly trust.
     */
    private function headerAlg(string $token): string
    {
        $segments = explode('.', $token);

        if (count($segments) !== 3) {
            throw new UnexpectedValueException('Malformed JWT: expected 3 segments.');
        }

        $decoded = JWT::urlsafeB64Decode($segments[0]);
        $header = json_decode($decoded, false);

        $alg = $header->alg ?? null;

        if (! is_string($alg) || ! in_array($alg, self::ALLOWED_ALGS, true)) {
            throw new UnexpectedValueException('Unsupported or missing JWT alg.');
        }

        return $alg;
    }

    private function hmacSecret(): string
    {
        $secret = config('supabase.jwt_secret');

        if (! is_string($secret) || $secret === '') {
            throw new RuntimeException('SUPABASE_JWT_SECRET is not configured.');
        }

        return $secret;
    }

    private function decodeWithJwks(string $token): stdClass
    {
        try {
            return JWT::decode($token, $this->jwks());
        } catch (UnexpectedValueException $e) {
            // A `kid` that isn't in the cached set usually means the project
            // rotated its signing keys. Refetch once before giving up.
            if (str_contains($e->getMessage(), 'kid')) {
                return JWT::decode($token, $this->jwks(forceRefresh: true));
            }

            throw $e;
        }
    }

    /**
     * Fetch (and cache) the project's JWKS, returning parsed verification keys
     * indexed by `kid`. The raw JWKS document is cached — Key objects are not
     * serializable — and parsed on each call (cheap).
     *
     * @return array<string, Key>
     */
    private function jwks(bool $forceRefresh = false): array
    {
        $url = $this->jwksUrl();
        $cacheKey = 'supabase:jwks:'.sha1($url);

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        }

        /** @var array<string, mixed> $raw */
        $raw = Cache::remember($cacheKey, self::JWKS_CACHE_TTL, function () use ($url): array {
            $response = Http::timeout(self::HTTP_TIMEOUT)
                ->acceptJson()
                ->get($url);

            if (! $response->successful()) {
                throw new RuntimeException("Failed to fetch Supabase JWKS (HTTP {$response->status()}).");
            }

            $body = (array) $response->json();

            // Guard the upstream shape explicitly so a malformed-but-200 JWKS
            // produces a clear log rather than an opaque parse error (and never
            // gets cached).
            if (! isset($body['keys']) || ! is_array($body['keys'])) {
                throw new RuntimeException('Malformed Supabase JWKS document: missing "keys".');
            }

            return $body;
        });

        // `ES256` default covers JWKS entries that omit the optional `alg`.
        return JWK::parseKeySet($raw, 'ES256');
    }

    private function jwksUrl(): string
    {
        $url = config('supabase.url');

        if (! is_string($url) || $url === '') {
            throw new RuntimeException(
                'SUPABASE_URL is required to verify asymmetric (ES256/RS256) tokens.'
            );
        }

        return rtrim($url, '/').'/auth/v1/.well-known/jwks.json';
    }
}
