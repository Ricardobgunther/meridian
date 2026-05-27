<?php

declare(strict_types=1);

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Members API — full CRUD coverage
|--------------------------------------------------------------------------
|
| Covers every route under
| `/api/v1/organizations/{organization}/members`. Cross-tenant 404 and
| soft-deleted-id 404 are intentionally NOT duplicated here — they're
| owned by `OrganizationsApiTest::cross-tenant access on /members/{member}`.
|
| Auth setup mirrors `OrganizationsApiTest`: the supabase JWT secret is
| swapped to the deterministic test constant, and we reuse the
| `actingAsSupabaseUser()` helper from `tests/Pest.php`.
|
*/

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

// ─── Index ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/organizations/{organization}/members', function (): void {
    it('returns all active members for the owner', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // Two more active members so we can check the count + content.
        $extraUsers = User::factory()->count(2)->create();
        foreach ($extraUsers as $u) {
            Membership::factory()->create([
                'organization_id' => $org->id,
                'user_id' => $u->id,
            ]);
        }

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members")
            ->assertOk();

        $response->assertJsonCount(3, 'data');

        // Every returned row carries its user payload (eager-loaded).
        foreach ($response->json('data') as $row) {
            expect($row)->toHaveKeys(['id', 'role', 'joined_at', 'user']);
            expect($row['user'])->toHaveKeys(['id', 'name', 'email']);
        }
    });

    it('paginates with per_page=2 across page 1 and page 2', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
            'joined_at' => '2026-01-01 00:00:00',
        ]);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
            'joined_at' => '2026-01-02 00:00:00',
        ]);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
            'joined_at' => '2026-01-03 00:00:00',
        ]);

        $page1 = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?per_page=2")
            ->assertOk();
        $page1->assertJsonCount(2, 'data');

        $page2 = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?per_page=2&page=2")
            ->assertOk();
        $page2->assertJsonCount(1, 'data');

        // No overlap between pages.
        $page1Ids = collect($page1->json('data'))->pluck('id')->all();
        $page2Ids = collect($page2->json('data'))->pluck('id')->all();
        expect(array_intersect($page1Ids, $page2Ids))->toBe([]);
    });

    it('filters by role=admin returning only admin rows', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);
        $admin = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?role=admin")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $admin->id);
        $response->assertJsonPath('data.0.role', 'admin');
    });

    it('filters q against the user name case-insensitively', function (): void {
        // We rely on LOWER() on the column (not engine-native LIKE
        // semantics) to keep results consistent between Postgres and
        // SQLite. The fully-uppercase row would silently disappear on
        // Postgres if LOWER() were stripped; the all-lowercase row would
        // disappear if the term lowercasing were stripped. Multibyte
        // case-folding (Ç/ç, Ã/ã) is out of scope here — SQLite's LIKE
        // is ASCII-only — so we keep the assertions to ASCII mixed-case.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $mariaUpper = User::factory()->create(['name' => 'MARIA SILVA', 'email' => 'maria.upper@example.com']);
        $mariaLower = User::factory()->create(['name' => 'maria silva', 'email' => 'maria.lower@example.com']);
        $joao = User::factory()->create(['name' => 'Joao Pereira', 'email' => 'joao@example.com']);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $mariaUpper->id]);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $mariaLower->id]);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $joao->id]);

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?q=Maria")
            ->assertOk();

        $response->assertJsonCount(2, 'data');

        $matchedUserIds = collect($response->json('data'))->pluck('user.id')->all();
        expect($matchedUserIds)->toContain($mariaUpper->id);
        expect($matchedUserIds)->toContain($mariaLower->id);
        expect($matchedUserIds)->not->toContain($joao->id);
    });

    it('filters q against the user email case-insensitively (substring)', function (): void {
        // Stores the email with an uppercase substring so that ASCII
        // engine-native LIKE on Postgres ('NEEDLE' LIKE '%needle%' is
        // false) would only succeed under the LOWER()-on-column path
        // the controller now uses.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = User::factory()->create(['name' => 'Different Name', 'email' => 'NEEDLE@example.com']);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $target->id]);

        $other = User::factory()->create(['name' => 'Other Person', 'email' => 'somebody@example.com']);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $other->id]);

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?q=needle")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.user.id', $target->id);
    });

    it('escapes literal LIKE wildcards in q so % matches "%" not "anything"', function (): void {
        // Regression: a search for "50%" must match the literal "50%"
        // substring, not act as a SQL LIKE wildcard. Otherwise
        // "500user@example.com" would also match — leaking unrelated
        // rows.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $literal = User::factory()->create(['name' => 'Has Percent', 'email' => '50%user@example.com']);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $literal->id]);

        $decoy = User::factory()->create(['name' => 'No Percent', 'email' => '500user@example.com']);
        Membership::factory()->create(['organization_id' => $org->id, 'user_id' => $decoy->id]);

        // URL-encode the percent sign so it survives transport to the
        // server unchanged.
        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?q=50%25")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.user.id', $literal->id);
    });

    it('intersects role and q filters', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // Member named Joao — should match q=joao + role=member.
        $joao = User::factory()->create(['name' => 'Joao Member', 'email' => 'joao.member@example.com']);
        $joaoMembership = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $joao->id,
        ]);

        // Admin named Joao — same q, different role → must NOT match.
        $joaoAdmin = User::factory()->create(['name' => 'Joao Admin', 'email' => 'joao.admin@example.com']);
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $joaoAdmin->id,
        ]);

        // Member named Maria — wrong q, right role → must NOT match.
        $maria = User::factory()->create(['name' => 'Maria', 'email' => 'maria@example.com']);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $maria->id,
        ]);

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?role=member&q=joao")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $joaoMembership->id);
    });

    it('returns 422 PT-BR when role is not in the allowed set', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?role=ghost")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role'])
            ->assertJsonPath('errors.role.0', 'A função deve ser "owner", "admin" ou "member".');
    });

    it('returns 422 PT-BR when q exceeds 100 chars', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $tooLong = str_repeat('a', 101);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?q={$tooLong}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['q'])
            ->assertJsonPath('errors.q.0', 'O termo de busca deve ter no máximo 100 caracteres.');
    });

    it('returns 422 PT-BR when per_page exceeds 100', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members?per_page=101")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['per_page'])
            ->assertJsonPath('errors.per_page.0', 'O parâmetro per_page não pode ser maior que 100.');
    });

    it('returns 403 when an outsider tries to list the roster', function (): void {
        // outsider is a member of org B, not org A.
        $outsider = User::factory()->create();
        $orgB = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $orgB->id,
            'user_id' => $outsider->id,
        ]);

        $orgA = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $orgA->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($outsider))
            ->getJson("/api/v1/organizations/{$orgA->id}/members")
            ->assertStatus(403);
    });

    it('returns 401 when not authenticated', function (): void {
        $org = Organization::factory()->create();

        $this->getJson("/api/v1/organizations/{$org->id}/members")
            ->assertStatus(401);
    });

    it('excludes soft-deleted memberships from the listing', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $left = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);
        $left->delete();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->getJson("/api/v1/organizations/{$org->id}/members")
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $owner->refresh()->memberships()->first()->id);
    });
});

// ─── Store ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/organizations/{organization}/members', function (): void {
    it('lets an owner add a member with the default role', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $newcomer = User::factory()->create();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $newcomer->id,
            ])
            ->assertStatus(201);

        $response->assertJsonPath('data.role', 'member');
        $response->assertJsonPath('data.user.id', $newcomer->id);

        $this->assertDatabaseHas('memberships', [
            'organization_id' => $org->id,
            'user_id' => $newcomer->id,
            'role' => 'member',
        ]);
    });

    it('lets an owner add a member with explicit role=admin', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $newcomer = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $newcomer->id,
                'role' => 'admin',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.role', 'admin');
    });

    it('allows an admin to add a new member', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $newcomer = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $newcomer->id,
            ])
            ->assertStatus(201);
    });

    it('returns 422 PT-BR when role=owner is requested', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $newcomer = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $newcomer->id,
                'role' => 'owner',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role'])
            ->assertJsonPath('errors.role.0', 'A função deve ser "admin" ou "member".');
    });

    it('returns 422 when user_id does not exist', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $missing = '00000000-0000-0000-0000-000000000000';

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $missing,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['user_id'])
            ->assertJsonPath('errors.user_id.0', 'Usuário não encontrado.');
    });

    it('returns 422 PT-BR when user is already an active member', function (): void {
        // "Already a member" is a service-layer DomainException, not a
        // validator failure — the controller maps it to 422 with the
        // `{ error: ... }` envelope (not the `{ errors: { field: [] } }`
        // validation envelope). The FormRequest deliberately does NOT
        // have a `unique` rule on (org, user) so soft-deleted prior
        // memberships can flow through to the service's restore path.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $existing = User::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $existing->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $existing->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Este usuário já é membro da organização.');
    });

    it('restores a previously-removed member (no 500, no duplicate row)', function (): void {
        // Regression: before the service grew restore semantics, this
        // path used to surface the DB unique-index collision as a
        // QueryException → HTTP 500. Now it must reactivate the
        // existing row, with the freshly requested role, and return
        // 201.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $returning = User::factory()->create();
        $previous = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $returning->id,
            'role' => 'member',
        ]);
        $previous->delete();

        $response = $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $returning->id,
                'role' => 'admin',
            ])
            ->assertStatus(201);

        // Same membership id → restored, not freshly inserted.
        $response->assertJsonPath('data.id', $previous->id);
        $response->assertJsonPath('data.role', 'admin');
        $response->assertJsonPath('data.user.id', $returning->id);

        // Exactly one row for the pair, and it is active.
        $totalRows = Membership::withTrashed()
            ->where('organization_id', $org->id)
            ->where('user_id', $returning->id)
            ->count();
        expect($totalRows)->toBe(1);
        $this->assertDatabaseHas('memberships', [
            'id' => $previous->id,
            'role' => 'admin',
            'deleted_at' => null,
        ]);
    });

    it('returns 422 when user_id is missing', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/members", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['user_id'])
            ->assertJsonPath('errors.user_id.0', 'Informe o usuário a ser adicionado.');
    });

    it('returns 403 when a plain member tries to add someone', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $newcomer = User::factory()->create();

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->postJson("/api/v1/organizations/{$org->id}/members", [
                'user_id' => $newcomer->id,
            ])
            ->assertStatus(403);

        $this->assertDatabaseMissing('memberships', [
            'organization_id' => $org->id,
            'user_id' => $newcomer->id,
        ]);
    });

    it('returns 403 when an outsider tries to add someone', function (): void {
        $outsider = User::factory()->create();
        // Outsider belongs to a different org so org.resolve does not
        // 403 them out before the policy runs — we need a clean policy
        // verdict here, not a middleware short-circuit.
        $otherOrg = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $otherOrg->id,
            'user_id' => $outsider->id,
        ]);

        $target = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $target->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $newcomer = User::factory()->create();

        // Outsider is not a member of $target → org.resolve will 403.
        $this
            ->withHeaders(actingAsSupabaseUser($outsider))
            ->postJson("/api/v1/organizations/{$target->id}/members", [
                'user_id' => $newcomer->id,
            ])
            ->assertStatus(403);
    });

    it('returns 401 when not authenticated', function (): void {
        $org = Organization::factory()->create();
        $u = User::factory()->create();

        $this
            ->postJson("/api/v1/organizations/{$org->id}/members", ['user_id' => $u->id])
            ->assertStatus(401);
    });
});

// ─── Update ──────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/organizations/{organization}/members/{member}', function (): void {
    it('lets an owner demote an admin to member', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$target->id}", [
                'role' => 'member',
            ])
            ->assertOk()
            ->assertJsonPath('data.role', 'member');

        $this->assertDatabaseHas('memberships', [
            'id' => $target->id,
            'role' => 'member',
        ]);
    });

    it('lets an admin set a member back to member (no-op succeeds)', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$target->id}", [
                'role' => 'member',
            ])
            ->assertOk()
            ->assertJsonPath('data.role', 'member');
    });

    it('lets the owner demote a co-owner to admin when another owner exists', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // Co-owner that we're going to demote.
        $coOwner = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$coOwner->id}", [
                'role' => 'admin',
            ])
            ->assertOk()
            ->assertJsonPath('data.role', 'admin');

        $this->assertDatabaseHas('memberships', [
            'id' => $coOwner->id,
            'role' => 'admin',
        ]);
    });

    it('returns 403 when an admin tries to modify another admin', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $peer = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$peer->id}", [
                'role' => 'member',
            ])
            ->assertStatus(403);

        $this->assertDatabaseHas('memberships', [
            'id' => $peer->id,
            'role' => 'admin',
        ]);
    });

    it('returns 403 when an admin tries to modify the owner', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$ownerMembership->id}", [
                'role' => 'member',
            ])
            ->assertStatus(403);
    });

    it('returns 403 when a plain member tries to modify anyone', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$target->id}", [
                'role' => 'member',
            ])
            ->assertStatus(403);
    });

    it('returns 422 PT-BR when role=owner is requested', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$target->id}", [
                'role' => 'owner',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role'])
            ->assertJsonPath('errors.role.0', 'A função deve ser "admin" ou "member".');
    });

    it('returns 422 PT-BR when demoting the last active owner', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // No other owner exists — demotion must be rejected.
        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$ownerMembership->id}", [
                'role' => 'admin',
            ])
            ->assertStatus(422)
            ->assertJsonPath(
                'error',
                'Não é possível remover o último proprietário da organização. Promova outro membro a owner antes de continuar.',
            );

        // Role unchanged in DB.
        $this->assertDatabaseHas('memberships', [
            'id' => $ownerMembership->id,
            'role' => 'owner',
        ]);
    });

    it('returns 404 when trying to update a soft-deleted membership', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $gone = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);
        $gone->delete();

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->patchJson("/api/v1/organizations/{$org->id}/members/{$gone->id}", [
                'role' => 'member',
            ])
            ->assertStatus(404);
    });
});

// ─── Destroy ─────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/organizations/{organization}/members/{member}', function (): void {
    it('lets the owner remove an admin (soft-delete)', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $admin = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$admin->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $admin->id]);
        // Row still exists (audit trail).
        expect(Membership::withTrashed()->whereKey($admin->id)->exists())->toBeTrue();
    });

    it('lets the owner remove a member', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$target->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $target->id]);
    });

    it('lets an admin remove a member', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$target->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $target->id]);
    });

    it('returns 403 when an admin tries to remove the owner', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$ownerMembership->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('memberships', [
            'id' => $ownerMembership->id,
            'deleted_at' => null,
        ]);
    });

    it('returns 403 when an admin tries to remove another admin', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $peer = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$peer->id}")
            ->assertStatus(403);
    });

    it('returns 403 when a plain member tries to remove anyone', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$target->id}")
            ->assertStatus(403);
    });

    it('returns 422 PT-BR when removing the last active owner', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$ownerMembership->id}")
            ->assertStatus(422)
            ->assertJsonPath(
                'error',
                'Não é possível remover o último proprietário da organização. Promova outro membro a owner antes de continuar.',
            );

        // Still active.
        $this->assertDatabaseHas('memberships', [
            'id' => $ownerMembership->id,
            'deleted_at' => null,
        ]);
    });

    it('removes the org from the removed user /me memberships', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $victim = User::factory()->create();
        $victimMembership = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $victim->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->deleteJson("/api/v1/organizations/{$org->id}/members/{$victimMembership->id}")
            ->assertStatus(204);

        $me = $this
            ->withHeaders(actingAsSupabaseUser($victim))
            ->getJson('/api/v1/me')
            ->assertOk();

        $orgIds = collect($me->json('memberships'))
            ->pluck('organization.id')
            ->all();

        expect($orgIds)->not->toContain($org->id);
    });
});
