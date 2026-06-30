<?php

declare(strict_types=1);

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Leave Organization API — POST /api/v1/organizations/{organization}/leave
|--------------------------------------------------------------------------
|
| Self-removal of the caller's own membership (spec
| dashboard-and-leave-org 00 §D1). Any active member may leave; the only
| business invariant is lone-owner protection, rendered as
| `422 { error, code: "lone_owner" }` by the handler in bootstrap/app.php.
|
| Auth setup mirrors `MembersApiTest`: deterministic test JWT secret +
| the `actingAsSupabaseUser()` helper from `tests/Pest.php`. Non-member
| access is rejected by `org.resolve` with 403 (same contract asserted in
| `MembersApiTest::returns 403 when an outsider tries to list the roster`).
|
*/

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

describe('POST /api/v1/organizations/{organization}/leave', function (): void {
    it('lets a plain member leave with 204 and soft-deletes the membership', function (): void {
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $member = User::factory()->create();
        $membership = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $membership->id]);
        // Row preserved (audit trail), not hard-deleted.
        expect(Membership::withTrashed()->whereKey($membership->id)->exists())->toBeTrue();
    });

    it('lets an admin leave with 204', function (): void {
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $admin = User::factory()->create();
        $membership = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($admin))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $membership->id]);
    });

    it('returns 422 lone_owner when the only owner tries to leave', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // A plain member does not satisfy the owner-count guard.
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(422)
            ->assertJsonPath('code', 'lone_owner')
            ->assertJsonPath(
                'error',
                'Não é possível remover o último proprietário da organização. Promova outro membro a owner antes de continuar.',
            );

        // Membership untouched — still active.
        $this->assertDatabaseHas('memberships', [
            'id' => $ownerMembership->id,
            'deleted_at' => null,
        ]);
    });

    it('lets an owner leave when another active owner exists', function (): void {
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // Co-owner keeps the org owned after the leave.
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(204);

        $this->assertSoftDeleted('memberships', ['id' => $ownerMembership->id]);
    });

    it('still rejects with 422 when the only other owner membership is soft-deleted', function (): void {
        // The guard must count ACTIVE owners only — a soft-deleted
        // co-owner row must not unlock the exit.
        $owner = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $formerOwner = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);
        $formerOwner->delete();

        $this
            ->withHeaders(actingAsSupabaseUser($owner))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(422)
            ->assertJsonPath('code', 'lone_owner');
    });

    it('removes the org from the leaver /me memberships', function (): void {
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $member = User::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(204);

        $me = $this
            ->withHeaders(actingAsSupabaseUser($member))
            ->getJson('/api/v1/me')
            ->assertOk();

        $orgIds = collect($me->json('memberships'))
            ->pluck('organization.id')
            ->all();

        expect($orgIds)->not->toContain($org->id);
    });

    it('returns 403 when the caller is not a member of the organization', function (): void {
        // Outsider belongs to a different org; org.resolve rejects them
        // before the controller runs (same contract as MembersApiTest).
        $outsider = User::factory()->create();
        $orgB = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $orgB->id,
            'user_id' => $outsider->id,
        ]);

        $orgA = Organization::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $orgA->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this
            ->withHeaders(actingAsSupabaseUser($outsider))
            ->postJson("/api/v1/organizations/{$orgA->id}/leave")
            ->assertStatus(403);

        // Nobody's membership was touched.
        $this->assertDatabaseHas('memberships', [
            'id' => $ownerMembership->id,
            'deleted_at' => null,
        ]);
    });

    it('returns 404 for an unknown organization id', function (): void {
        $user = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
        ]);

        $missing = '00000000-0000-0000-0000-000000000000';

        $this
            ->withHeaders(actingAsSupabaseUser($user))
            ->postJson("/api/v1/organizations/{$missing}/leave")
            ->assertStatus(404);
    });

    it('returns 401 when not authenticated', function (): void {
        $org = Organization::factory()->create();

        $this->postJson("/api/v1/organizations/{$org->id}/leave")
            ->assertStatus(401);
    });
});
