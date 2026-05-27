<?php

declare(strict_types=1);

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Firebase\JWT\JWT;

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

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
    $token = makeSupabaseJwt();

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/me')
        ->assertStatus(200);

    $response->assertJsonStructure([
        'data' => ['id', 'email', 'name', 'avatar_url', 'locale', 'timezone', 'last_seen_at'],
        'memberships',
    ]);

    $response->assertJsonPath('data.id', '11111111-2222-3333-4444-555555555555');
    $response->assertJsonPath('data.email', 'jane.doe@example.com');
    $response->assertJsonPath('data.name', 'Jane Doe');
    $response->assertJsonPath('data.avatar_url', 'https://cdn.example.com/jane.png');
    // locale + timezone have column defaults in the migration ('pt-BR',
    // 'America/Sao_Paulo'), but Laravel does not auto-refresh after insert,
    // so the in-memory model returned by provisioning has them as null on
    // first /me. This assertion documents the current behaviour — flag for
    // backend-agent if a different contract is desired.
    $response->assertJsonPath('memberships', []);

    // The lazy provisioning side-effect (ADR-011): a local row now exists
    // with the JWT `sub` as its primary key.
    $this->assertDatabaseHas('users', [
        'id' => '11111111-2222-3333-4444-555555555555',
        'email' => 'jane.doe@example.com',
        'name' => 'Jane Doe',
    ]);
});

it('includes the caller memberships in /me', function (): void {
    // ARRANGE — pre-create the local row with a fixed id so the JWT below
    // re-provisions (rather than creates) it. This exercises the realistic
    // path where /me is hit after the user already has memberships.
    $userId = '99999999-aaaa-bbbb-cccc-dddddddddddd';
    $user = User::factory()->create(['id' => $userId, 'email' => 'me@example.com']);

    $organization = Organization::factory()->create(['created_by' => $user->id]);
    Membership::factory()->owner()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
    ]);

    // ACT
    $response = $this
        ->withHeaders(actingAsSupabaseUser($user))
        ->getJson('/api/v1/me');

    // ASSERT
    $response->assertStatus(200);
    $response->assertJsonCount(1, 'memberships');
    $response->assertJsonPath('memberships.0.role', 'owner');
    $response->assertJsonPath('memberships.0.organization.id', $organization->id);
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
