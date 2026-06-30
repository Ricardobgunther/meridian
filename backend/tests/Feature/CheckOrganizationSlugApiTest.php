<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Check Slug API — GET /api/v1/organizations/check-slug?slug=...
|--------------------------------------------------------------------------
|
| Advisory slug-availability preview (spec dashboard-and-leave-org 00 §D2).
| The critical contract is PARITY: `available` must mirror the uniqueness
| rule of `POST /organizations` exactly — including the "soft-deleted org
| frees its slug" semantics — or the live preview lies to the user.
|
| Auth setup mirrors `OrganizationsApiTest` (test JWT secret +
| `actingAsSupabaseUser()`).
|
*/

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

describe('GET /api/v1/organizations/check-slug', function (): void {
    it('reports an unused slug as available', function (): void {
        $user = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug=fresh-slug')
            ->assertOk()
            ->assertJsonPath('data.slug', 'fresh-slug')
            ->assertJsonPath('data.available', true);
    });

    it('reports a slug held by an active organization as unavailable', function (): void {
        $user = User::factory()->create();
        Organization::factory()->create(['slug' => 'taken-slug']);

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug=taken-slug')
            ->assertOk()
            ->assertJsonPath('data.slug', 'taken-slug')
            ->assertJsonPath('data.available', false);
    });

    it('check-slug and POST /organizations agree that a soft-deleted org frees its slug (parity)', function (): void {
        // Overview 00 §7.2: the preview must mirror the POST uniqueness
        // rule (`unique:organizations,slug` scoped to deleted_at IS NULL).
        // Both halves are asserted together because the behavior under
        // test is their AGREEMENT, not each endpoint in isolation.
        $user = User::factory()->create();

        $ghost = Organization::factory()->create(['slug' => 'recycled-slug']);
        $ghost->delete();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug=recycled-slug')
            ->assertOk()
            ->assertJsonPath('data.available', true);

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', [
                'name' => 'Recycled Org',
                'slug' => 'recycled-slug',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.slug', 'recycled-slug');
    });

    it('returns 422 PT-BR for invalid slug formats', function (string $invalidSlug): void {
        $user = User::factory()->create();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug='.urlencode($invalidSlug))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['slug']);

        $errors = $response->json('errors.slug');
        expect($errors)->toContain('O identificador deve conter apenas letras minúsculas, números e hífens.');
    })->with([
        'uppercase' => ['Acme'],
        'spaces' => ['acme inc'],
        'underscore' => ['acme_inc'],
        'trailing hyphen' => ['acme-'],
        'double hyphen' => ['acme--inc'],
    ]);

    it('accepts 1–2 character slugs, in parity with POST /organizations (deviation from spec D2 "3–60")', function (): void {
        // Documented in StoreOrganizationRequest::slugFormatRules(): the
        // shared format rules use min:1, and POST↔check parity dominates
        // the spec's 3-char lower bound.
        $user = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug=a')
            ->assertOk()
            ->assertJsonPath('data.available', true);
    });

    it('returns 422 PT-BR when slug is missing', function (): void {
        $user = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['slug'])
            ->assertJsonPath('errors.slug.0', 'Informe o identificador (slug) da organização.');
    });

    it('returns 422 when slug exceeds 60 characters', function (): void {
        $user = User::factory()->create();
        $tooLong = str_repeat('a', 61);

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson("/api/v1/organizations/check-slug?slug={$tooLong}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['slug'])
            ->assertJsonPath('errors.slug.0', 'O identificador não pode ter mais de 60 caracteres.');
    });

    it('responds with Cache-Control: no-store', function (): void {
        // The verdict is per-keystroke; an intermediary replaying a
        // cached `available: true` would contradict the POST's 422.
        $user = User::factory()->create();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations/check-slug?slug=any-slug')
            ->assertOk();

        // Symfony may normalize the directive list (e.g. append
        // "private"), so assert on the no-store directive itself.
        expect($response->headers->get('Cache-Control'))->toContain('no-store');
    });

    it('returns 401 when not authenticated', function (): void {
        $this
            ->getJson('/api/v1/organizations/check-slug?slug=fresh-slug')
            ->assertStatus(401);
    });

    it('registers the named check_slug limiter on the route', function (): void {
        $route = collect(app('router')->getRoutes()->getRoutes())
            ->first(fn ($r) => $r->getName() === 'v1.organizations.check-slug');

        expect($route)->not->toBeNull();
        expect($route->gatherMiddleware())->toContain('throttle:check_slug');
    });

    it('rejects with 429 once the check_slug limit (30/min) is exhausted', function (): void {
        // The limiter is keyed by IP (see AppServiceProvider: throttle
        // middleware runs before token verification, so the user is not
        // available there), so every in-process request shares one bucket.
        $user = User::factory()->create();
        $headers = actingAsSupabaseUser($user);

        $statuses = [];
        for ($i = 0; $i < 31; $i++) {
            $statuses[] = $this
                ->withHeaders($headers)
                ->getJson('/api/v1/organizations/check-slug?slug=fresh-slug')
                ->getStatusCode();
        }

        expect(array_slice($statuses, 0, 30))->each->toBe(200);
        expect($statuses[30])->toBe(429);
    });
});
