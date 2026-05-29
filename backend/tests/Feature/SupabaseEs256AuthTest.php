<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;

/*
|--------------------------------------------------------------------------
| Asymmetric (ES256) Supabase auth
|--------------------------------------------------------------------------
|
| Projects on Supabase's current "JWT signing keys" sign user access tokens
| with ES256. The backend must verify them against the project's published
| JWKS (see SupabaseTokenVerifier). These tests exercise that path with a
| locally-generated EC keypair and a faked JWKS endpoint — no network.
|
*/

const ES256_KID = 'test-es256-kid';
const SUPABASE_TEST_URL = 'https://test-project.supabase.co';

/**
 * Generate a fresh P-256 keypair and return both the private key (for signing
 * test tokens) and a JWKS document built from its public coordinates (what the
 * faked endpoint will serve).
 *
 * @return array{key: \OpenSSLAsymmetricKey, jwks: array<string, mixed>}
 */
function makeEs256KeyAndJwks(string $kid = ES256_KID): array
{
    $key = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]);

    $details = openssl_pkey_get_details($key);
    $b64url = static fn (string $bin): string => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');

    $jwks = [
        'keys' => [[
            'kty' => 'EC',
            'crv' => 'P-256',
            'alg' => 'ES256',
            'use' => 'sig',
            'kid' => $kid,
            'x' => $b64url($details['ec']['x']),
            'y' => $b64url($details['ec']['y']),
        ]],
    ];

    return ['key' => $key, 'jwks' => $jwks];
}

/**
 * Forge an ES256 Supabase-shaped access token signed with the given key.
 *
 * @param  array<string, mixed>  $overrides
 */
function makeEs256Jwt(\OpenSSLAsymmetricKey $key, array $overrides = [], string $kid = ES256_KID): string
{
    $now = time();

    $payload = array_merge([
        'sub' => '99999999-8888-7777-6666-555555555555',
        'email' => 'oauth.user@example.com',
        'aud' => 'authenticated',
        'role' => 'authenticated',
        'iss' => SUPABASE_TEST_URL.'/auth/v1',
        'iat' => $now,
        'exp' => $now + 3600,
        'user_metadata' => [
            'full_name' => 'OAuth User',
            'avatar_url' => 'https://cdn.example.com/oauth.png',
        ],
    ], $overrides);

    return JWT::encode($payload, $key, 'ES256', $kid);
}

beforeEach(function (): void {
    config([
        // No HS256 secret needed for the asymmetric path; URL drives both the
        // JWKS lookup and the issuer check.
        'supabase.jwt_secret' => null,
        'supabase.url' => SUPABASE_TEST_URL,
    ]);
});

it('accepts an ES256 token verified against the project JWKS', function (): void {
    ['key' => $key, 'jwks' => $jwks] = makeEs256KeyAndJwks();

    Http::fake([
        SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json' => Http::response($jwks, 200),
    ]);

    $token = makeEs256Jwt($key);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.email', 'oauth.user@example.com')
        ->assertJsonPath('data.name', 'OAuth User');
});

it('rejects an ES256 token signed by a key absent from the JWKS', function (): void {
    // The endpoint serves one key; the token is signed by a different one.
    ['jwks' => $jwks] = makeEs256KeyAndJwks();
    ['key' => $attackerKey] = makeEs256KeyAndJwks('other-kid');

    Http::fake([
        SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json' => Http::response($jwks, 200),
    ]);

    // Reuse the JWKS kid so lookup succeeds but signature verification fails.
    $token = makeEs256Jwt($attackerKey);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('caches the JWKS across requests instead of refetching each time', function (): void {
    ['key' => $key, 'jwks' => $jwks] = makeEs256KeyAndJwks();

    Http::fake([
        SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json' => Http::response($jwks, 200),
    ]);

    $token = makeEs256Jwt($key);
    $headers = ['Authorization' => "Bearer {$token}"];

    $this->withHeaders($headers)->getJson('/api/v1/me')->assertOk();
    $this->withHeaders($headers)->getJson('/api/v1/me')->assertOk();

    // Two authenticated requests, a single JWKS fetch.
    Http::assertSentCount(1);
});

it('falls back to 401 when the JWKS endpoint is unreachable', function (): void {
    ['key' => $key] = makeEs256KeyAndJwks();

    Http::fake([
        SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json' => Http::response('upstream down', 503),
    ]);

    $token = makeEs256Jwt($key);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('rejects an alg:none token before any key is selected', function (): void {
    Http::fake(); // must never be hit

    $segment = static fn (array $data): string => rtrim(strtr(base64_encode(json_encode($data)), '+/', '-_'), '=');
    $now = time();
    // Header alg=none, empty signature — the canonical "alg confusion" attack.
    $token = $segment(['alg' => 'none', 'typ' => 'JWT'])
        .'.'.$segment(['sub' => 'attacker', 'aud' => 'authenticated', 'exp' => $now + 3600])
        .'.';

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);

    Http::assertNothingSent();
});

it('rejects an ES256 token whose header was downgraded to HS256', function (): void {
    ['key' => $key, 'jwks' => $jwks] = makeEs256KeyAndJwks();

    Http::fake([
        SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json' => Http::response($jwks, 200),
    ]);

    // Sign legitimately with ES256, then tamper the header alg to HS256 while
    // keeping the (now invalid) signature. The verifier must not pair this with
    // the HMAC secret nor accept it against the ES256 JWKS key.
    config(['supabase.jwt_secret' => TEST_JWT_SECRET]);
    $valid = makeEs256Jwt($key);
    [, $payload, $sig] = explode('.', $valid);
    $forgedHeader = rtrim(strtr(base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT', 'kid' => ES256_KID])), '+/', '-_'), '=');
    $tampered = "{$forgedHeader}.{$payload}.{$sig}";

    $this->withHeader('Authorization', "Bearer {$tampered}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('refetches the JWKS once when the token kid is absent from the cached set', function (): void {
    // First fetch serves a key with a different kid; the token's kid is missing,
    // so the verifier must bust the cache and refetch (second response carries
    // the right key).
    ['jwks' => $staleJwks] = makeEs256KeyAndJwks('stale-kid');
    ['key' => $key, 'jwks' => $freshJwks] = makeEs256KeyAndJwks(ES256_KID);

    Http::fakeSequence(SUPABASE_TEST_URL.'/auth/v1/.well-known/jwks.json')
        ->push($staleJwks, 200)
        ->push($freshJwks, 200);

    $token = makeEs256Jwt($key, kid: ES256_KID);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertOk();

    // Stale set (cache miss) + refetch after kid miss = exactly two fetches.
    Http::assertSentCount(2);
});

it('rejects a malformed token that is not three segments', function (): void {
    Http::fake();

    $this->withHeader('Authorization', 'Bearer not.two')
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);

    Http::assertNothingSent();
});
