<?php

declare(strict_types=1);

use Firebase\JWT\JWT;

// Supabase JWT secrets are HS256 -> need at least 32 bytes (256 bits).
const TEST_JWT_SECRET = 'test-supabase-jwt-secret-with-32+bytes!!';
const WRONG_JWT_SECRET = 'another-wrong-secret-also-32+bytes-long!';

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

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

it('returns 401 sem token', function (): void {
    $this->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Não autenticado.']);
});

it('returns 401 com token inválido', function (): void {
    $this->withHeader('Authorization', 'Bearer not-a-real-jwt')
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('returns 401 quando assinado com segredo diferente', function (): void {
    $token = makeSupabaseJwt(secret: WRONG_JWT_SECRET);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('rejects token sem claim sub', function (): void {
    $now = time();

    // Build payload without `sub` — array_merge cannot remove keys, so encode directly.
    $token = JWT::encode([
        'email' => 'jane.doe@example.com',
        'aud' => 'authenticated',
        'role' => 'authenticated',
        'iat' => $now,
        'exp' => $now + 3600,
    ], TEST_JWT_SECRET, 'HS256');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('rejects token sem claim exp', function (): void {
    $now = time();

    $token = JWT::encode([
        'sub' => '11111111-2222-3333-4444-555555555555',
        'email' => 'jane.doe@example.com',
        'aud' => 'authenticated',
        'role' => 'authenticated',
        'iat' => $now,
    ], TEST_JWT_SECRET, 'HS256');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('rejects token com aud errado', function (): void {
    $token = makeSupabaseJwt(['aud' => 'anon']);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});

it('returns user data com token válido', function (): void {
    $iat = time();
    $token = makeSupabaseJwt(['iat' => $iat]);

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(200);

    $response->assertJson([
        'data' => [
            'id' => '11111111-2222-3333-4444-555555555555',
            'email' => 'jane.doe@example.com',
            'name' => 'Jane Doe',
            'avatar_url' => 'https://cdn.example.com/jane.png',
            'provider' => 'google',
            'providers' => ['google', 'email'],
            'created_at' => gmdate('Y-m-d\TH:i:s+00:00', $iat),
        ],
    ]);
});

it('accepts token com iss correto quando SUPABASE_URL configurado', function (): void {
    config(['supabase.url' => 'https://test.supabase.co']);
    $token = makeSupabaseJwt(['iss' => 'https://test.supabase.co/auth/v1']);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(200);
});

it('rejects token com iss errado quando SUPABASE_URL configurado', function (): void {
    config(['supabase.url' => 'https://test.supabase.co']);
    $token = makeSupabaseJwt(['iss' => 'https://attacker.com/auth/v1']);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(401)
        ->assertExactJson(['error' => 'Sessão expirada ou inválida.']);
});
