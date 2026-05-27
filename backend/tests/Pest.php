<?php

declare(strict_types=1);

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| All Feature tests touch the database (the Supabase auth middleware
| lazy-provisions a `users` row on every authenticated request — ADR-011),
| so RefreshDatabase is applied across the whole `Feature` directory to
| keep tests isolated and deterministic.
|
*/

pest()->extend(Tests\TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain
| conditions. The "expect()" function gives you access to a set of "expectations"
| methods that you can use to assert different things. Of course, you may extend
| the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
*/

// HS256 needs >= 32 bytes (256 bits). Re-used by Feature tests that mint
// their own Supabase-style JWTs.
const TEST_JWT_SECRET = 'test-supabase-jwt-secret-with-32+bytes!!';
const WRONG_JWT_SECRET = 'another-wrong-secret-also-32+bytes-long!';

/**
 * Build a Supabase-shaped JWT for tests. Any claim can be overridden via
 * `$overrides`; unknown overrides win against the defaults via array_merge.
 *
 * @param  array<string, mixed>  $overrides
 */
function makeSupabaseJwt(array $overrides = [], ?string $secret = null): string
{
    $now = time();

    $payload = array_merge([
        'sub' => '11111111-2222-3333-4444-555555555555',
        'email' => 'jane.doe@example.com',
        'aud' => 'authenticated',
        'role' => 'authenticated',
        'iat' => $now,
        'exp' => $now + 3600,
        'user_metadata' => [
            'full_name' => 'Jane Doe',
            'avatar_url' => 'https://cdn.example.com/jane.png',
        ],
        'app_metadata' => [
            'provider' => 'google',
            'providers' => ['google', 'email'],
        ],
    ], $overrides);

    return JWT::encode($payload, $secret ?? config('supabase.jwt_secret'), 'HS256');
}

/**
 * Mint a JWT for an existing local `User` row and return an Authorization
 * header tuple ready to feed into `->withHeaders(...)`.
 *
 * @return array{Authorization: string}
 */
function actingAsSupabaseUser(User $user): array
{
    $token = makeSupabaseJwt([
        'sub' => $user->id,
        'email' => $user->email,
        'user_metadata' => [
            'full_name' => $user->name,
            'avatar_url' => $user->avatar_url,
        ],
    ]);

    return ['Authorization' => "Bearer {$token}"];
}
