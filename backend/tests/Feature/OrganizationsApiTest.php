<?php

declare(strict_types=1);

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

// ─── List ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/organizations', function (): void {
    it('returns only the orgs the caller has active membership in', function (): void {
        $user = User::factory()->create();

        $mine = Organization::factory()->count(2)->create(['created_by' => $user->id]);
        foreach ($mine as $org) {
            Membership::factory()->owner()->create([
                'organization_id' => $org->id,
                'user_id' => $user->id,
            ]);
        }

        // Another org the user is not part of — must not appear.
        Organization::factory()->create();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations')
            ->assertOk();

        $response->assertJsonCount(2, 'data');

        $returnedIds = collect($response->json('data'))->pluck('id')->sort()->values()->all();
        $expectedIds = $mine->pluck('id')->sort()->values()->all();

        expect($returnedIds)->toEqual($expectedIds);
    });

    it('excludes orgs where the caller membership has been soft-deleted', function (): void {
        $user = User::factory()->create();

        $active = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $active->id,
            'user_id' => $user->id,
        ]);

        $leftBehind = Organization::factory()->create();
        $oldMembership = Membership::factory()->owner()->create([
            'organization_id' => $leftBehind->id,
            'user_id' => $user->id,
        ]);
        $oldMembership->delete();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations')
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $active->id);
    });

    it('returns 401 when no Authorization header is sent', function (): void {
        $this->getJson('/api/v1/organizations')->assertStatus(401);
    });
});

// ─── Create ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/organizations', function (): void {
    it('creates an org and an owner membership inside a single transaction', function (): void {
        $user = User::factory()->create();

        $orgsBefore = Organization::count();
        $membershipsBefore = Membership::count();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', [
                'name' => 'Acme Inc.',
                'slug' => 'acme-inc',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('data.name', 'Acme Inc.');
        $response->assertJsonPath('data.slug', 'acme-inc');
        $response->assertJsonPath('data.your_role', 'owner');

        expect(Organization::count())->toBe($orgsBefore + 1);
        expect(Membership::count())->toBe($membershipsBefore + 1);

        $this->assertDatabaseHas('organizations', [
            'slug' => 'acme-inc',
            'name' => 'Acme Inc.',
            'created_by' => $user->id,
        ]);

        $this->assertDatabaseHas('memberships', [
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
    });

    it('rejects invalid slug formats with 422 and PT-BR validation message', function (string $invalidSlug): void {
        $user = User::factory()->create();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', [
                'name' => 'Acme Inc.',
                'slug' => $invalidSlug,
            ])
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

    it('rejects a slug already in use by an active org with 422', function (): void {
        $user = User::factory()->create();

        Organization::factory()->create(['slug' => 'taken-slug']);

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', [
                'name' => 'Other Org',
                'slug' => 'taken-slug',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['slug'])
            ->assertJsonPath('errors.slug.0', 'Este identificador já está em uso.');
    });

    it('allows reusing a slug from a soft-deleted org', function (): void {
        $user = User::factory()->create();

        $previous = Organization::factory()->create(['slug' => 'reusable-slug']);
        $previous->delete();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', [
                'name' => 'New Org With Old Slug',
                'slug' => 'reusable-slug',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.slug', 'reusable-slug');
    });

    it('returns 422 when name is missing', function (): void {
        $user = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/organizations', ['slug' => 'ok-slug'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    });

    it('returns 401 when not authenticated', function (): void {
        $this->postJson('/api/v1/organizations', ['name' => 'X', 'slug' => 'x'])
            ->assertStatus(401);
    });
});

// ─── Show ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/organizations/{organization}', function (): void {
    it('returns the org with your_role for active members', function (): void {
        $user = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson("/api/v1/organizations/{$org->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $org->id)
            ->assertJsonPath('data.your_role', 'admin');
    });

    it('returns 403 PT-BR for users without an active membership', function (): void {
        $outsider = User::factory()->create();
        $org = Organization::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($outsider))
            ->getJson("/api/v1/organizations/{$org->id}")
            ->assertStatus(403)
            ->assertJsonPath('error', 'Você não tem acesso a esta organização.');
    });

    it('returns 404 for a non-existent org id', function (): void {
        $user = User::factory()->create();
        $missingId = '00000000-0000-0000-0000-000000000000';

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson("/api/v1/organizations/{$missingId}")
            ->assertStatus(404);
    });
});

// ─── Update ──────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/organizations/{organization}', function (): void {
    it('allows owner to rename the organization', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}", ['name' => 'Renamed Co'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Co');

        $this->assertDatabaseHas('organizations', ['id' => $org->id, 'name' => 'Renamed Co']);
    });

    it('allows admin to update the organization', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->patchJson("/api/v1/organizations/{$org->id}", ['name' => 'Admin Edit'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Admin Edit');
    });

    it('returns 403 when a plain member tries to update the org', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->patchJson("/api/v1/organizations/{$org->id}", ['name' => 'No Touch'])
            ->assertStatus(403);

        $this->assertDatabaseMissing('organizations', ['id' => $org->id, 'name' => 'No Touch']);
    });
});

// ─── Delete ──────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/organizations/{organization}', function (): void {
    it('allows only the owner to delete the organization', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('organizations', ['id' => $org->id]);
    });

    it('returns 403 when an admin attempts to delete the organization', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->deleteJson("/api/v1/organizations/{$org->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('organizations', ['id' => $org->id, 'deleted_at' => null]);
    });

    it('soft-deletes all active memberships when the org is deleted', function (): void {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $org = Organization::factory()->create();

        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $other->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('organizations', ['id' => $org->id]);

        // Both memberships soft-deleted in the same transaction.
        expect(Membership::query()->where('organization_id', $org->id)->whereNull('deleted_at')->count())->toBe(0);
        expect(Membership::withTrashed()->where('organization_id', $org->id)->count())->toBe(2);

        // The other user no longer sees the org in their listing.
        $this
            ->withHeaders(actingAsSupabaseUser($other))
            ->getJson('/api/v1/organizations')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    });
});

// ─── Cross-tenant safety (BL-1) ──────────────────────────────────────────────

describe('cross-tenant access on /members/{member}', function (): void {
    it('returns 404 when the member id belongs to a different organization', function (): void {
        // Two unrelated orgs, each with its own admin and one extra member.
        $adminA = User::factory()->create();
        $orgA = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $orgA->id,
            'user_id' => $adminA->id,
        ]);

        $orgB = Organization::factory()->create();
        $victim = User::factory()->create();
        $victimMembership = Membership::factory()->create([
            'organization_id' => $orgB->id,
            'user_id' => $victim->id,
        ]);

        // Admin of A also has an active membership in B so org.resolve
        // wouldn't block them — the bypass attempt is purely on the id.
        Membership::factory()->admin()->create([
            'organization_id' => $orgB->id,
            'user_id' => $adminA->id,
        ]);

        // Tries to modify a member of B by addressing org A in the URL.
        $this
            ->withHeaders(actingAsSupabaseUser($adminA))
            ->patchJson("/api/v1/organizations/{$orgA->id}/members/{$victimMembership->id}", [
                'role' => 'admin',
            ])
            ->assertStatus(404);

        $this
            ->withHeaders(actingAsSupabaseUser($adminA))
            ->deleteJson("/api/v1/organizations/{$orgA->id}/members/{$victimMembership->id}")
            ->assertStatus(404);
    });

    it('returns 404 for a soft-deleted member id', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $gone = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);
        $gone->delete();

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$gone->id}")
            ->assertStatus(404);
    });
});

// ─── Listing N+1 ─────────────────────────────────────────────────────────────

describe('GET /api/v1/organizations query count (BL-4)', function (): void {
    it('renders your_role from the pivot without firing one query per row', function (): void {
        $user = User::factory()->create();

        // 20 rows on purpose: any per-row `roleIn()` would add ~20
        // queries on top of the baseline (~3 for auth + count + list),
        // which the threshold below catches comfortably. 5 rows would
        // fit within a loose threshold even with the regression in
        // place — defeating the test's purpose.
        $orgs = Organization::factory()->count(20)->create();
        foreach ($orgs as $org) {
            Membership::factory()->owner()->create([
                'organization_id' => $org->id,
                'user_id' => $user->id,
            ]);
        }

        \Illuminate\Support\Facades\DB::enableQueryLog();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->getJson('/api/v1/organizations?per_page=20')
            ->assertOk()
            ->assertJsonCount(20, 'data');

        // Every row must surface its role.
        foreach ($response->json('data') as $row) {
            expect($row['your_role'])->toBe('owner');
        }

        $queries = \Illuminate\Support\Facades\DB::getQueryLog();
        \Illuminate\Support\Facades\DB::disableQueryLog();

        // Baseline today is ~5 queries (user upsert + transaction +
        // count + listing). An N+1 on `roleIn()` would push that to
        // ~25. Threshold 10 catches the regression class with margin.
        expect(count($queries))->toBeLessThan(10, sprintf(
            'Listing emitted %d queries for 20 rows — likely an N+1 regression on roleIn().',
            count($queries),
        ));
    });
});
