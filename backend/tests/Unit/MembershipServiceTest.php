<?php

declare(strict_types=1);

use App\Enums\MembershipRole;
use App\Exceptions\Domain\LoneOwnerException;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Services\MembershipService;
use Illuminate\Foundation\Testing\RefreshDatabase;

/*
|--------------------------------------------------------------------------
| MembershipService — unit tests
|--------------------------------------------------------------------------
|
| Drives the service directly, without the HTTP layer. The Pest bootstrap
| in `tests/Pest.php` only extends `Tests\TestCase` for the Feature
| directory, so opt in here to gain Laravel bootstrapping +
| RefreshDatabase. Mirrors the pattern in `UserProvisioningServiceTest`.
|
*/
uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    $this->service = app(MembershipService::class);
});

// ─── guardLastOwner (private — exercised via changeRole/remove) ──────────────

describe('MembershipService::guardLastOwner', function (): void {
    it('allows removing one owner when another active owner exists', function (): void {
        $org = Organization::factory()->create();

        $ownerA = User::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $ownerA->id,
        ]);

        $ownerB = User::factory()->create();
        $ownerBMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $ownerB->id,
        ]);

        // Removing $ownerB while $ownerA remains is fine.
        $this->service->remove($ownerBMembership, $ownerA);

        expect($ownerBMembership->fresh()->trashed())->toBeTrue();
    });

    it('blocks removing the only active owner with LoneOwnerException', function (): void {
        $org = Organization::factory()->create();

        $owner = User::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // A second non-owner doesn't satisfy the guard.
        $admin = User::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        expect(fn () => $this->service->remove($ownerMembership, $owner))
            ->toThrow(
                LoneOwnerException::class,
                'Não é possível remover o último proprietário da organização. Promova outro membro a owner antes de continuar.',
            );

        // Still active.
        expect($ownerMembership->fresh()->trashed())->toBeFalse();
    });

    it('excludes the TARGET membership from the active-owner count (regression: id != target)', function (): void {
        // Regression guard: if `where('id', '!=', $member->id)` were
        // dropped from guardLastOwner, this scenario would incorrectly
        // count the target itself and falsely report "another owner
        // exists", allowing the demotion. With the filter intact, the
        // service must raise LoneOwnerException.
        $org = Organization::factory()->create();

        $owner = User::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        expect(fn () => $this->service->changeRole($ownerMembership, MembershipRole::Admin, $owner))
            ->toThrow(LoneOwnerException::class);
    });

    it('ignores soft-deleted owner rows when counting remaining owners', function (): void {
        $org = Organization::factory()->create();

        $ownerA = User::factory()->create();
        $ownerAMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $ownerA->id,
        ]);

        // A second owner exists but has been soft-deleted — must NOT
        // be counted as "another active owner".
        $ownerB = User::factory()->create();
        $ownerBMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $ownerB->id,
        ]);
        $ownerBMembership->delete();

        expect(fn () => $this->service->remove($ownerAMembership, $ownerA))
            ->toThrow(LoneOwnerException::class);
    });
});

// ─── changeRole ──────────────────────────────────────────────────────────────

describe('MembershipService::changeRole', function (): void {
    it('rejects MembershipRole::Owner outright (no API-driven ownership transfer)', function (): void {
        $org = Organization::factory()->create();

        $owner = User::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        expect(fn () => $this->service->changeRole($target, MembershipRole::Owner, $owner))
            ->toThrow(
                DomainException::class,
                'Não é possível promover um membro a owner por esta rota.',
            );

        // Role unchanged.
        expect($target->fresh()->role)->toBe(MembershipRole::Admin);
    });

    it('invokes the lone-owner guard when demoting the last owner', function (): void {
        $org = Organization::factory()->create();

        $owner = User::factory()->create();
        $ownerMembership = Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        // No co-owner → guard must fire.
        expect(fn () => $this->service->changeRole($ownerMembership, MembershipRole::Member, $owner))
            ->toThrow(LoneOwnerException::class);

        expect($ownerMembership->fresh()->role)->toBe(MembershipRole::Owner);
    });

    it('rejects an actor without canManageMembers permission', function (): void {
        $org = Organization::factory()->create();

        // The actor is just a plain member — cannot change roles.
        $actor = User::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $actor->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        expect(fn () => $this->service->changeRole($target, MembershipRole::Admin, $actor))
            ->toThrow(
                DomainException::class,
                'Você não tem permissão para alterar este membro.',
            );
    });

    it('blocks an admin from modifying a peer or higher rank', function (): void {
        $org = Organization::factory()->create();

        $adminActor = User::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $adminActor->id,
        ]);

        $peerAdmin = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        expect(fn () => $this->service->changeRole($peerAdmin, MembershipRole::Member, $adminActor))
            ->toThrow(
                DomainException::class,
                'Você não pode alterar um membro com função igual ou superior à sua.',
            );

        expect($peerAdmin->fresh()->role)->toBe(MembershipRole::Admin);
    });
});

// ─── add (the service's "invite by id" entry point) ──────────────────────────

describe('MembershipService::add', function (): void {
    it('creates an active member membership and stamps joined_at', function (): void {
        $org = Organization::factory()->create();
        $user = User::factory()->create();

        $membership = $this->service->add($org, $user, MembershipRole::Member);

        expect($membership->organization_id)->toBe($org->id);
        expect($membership->user_id)->toBe($user->id);
        expect($membership->role)->toBe(MembershipRole::Member);
        expect($membership->joined_at)->not->toBeNull();
        expect($membership->trashed())->toBeFalse();
    });

    it('throws when the user already has an active membership in the org', function (): void {
        $org = Organization::factory()->create();
        $user = User::factory()->create();

        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
        ]);

        expect(fn () => $this->service->add($org, $user, MembershipRole::Member))
            ->toThrow(
                DomainException::class,
                'Este usuário já é membro da organização.',
            );

        // No second active row was created.
        $activeCount = Membership::query()
            ->where('organization_id', $org->id)
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->count();
        expect($activeCount)->toBe(1);
    });

    it('restores a previously-soft-deleted membership instead of inserting a new row', function (): void {
        // The DB unique index `uniq_memberships_org_user` covers ALL
        // rows (including trashed ones), so a naive re-insert after a
        // soft-delete would explode as QueryException → HTTP 500. The
        // service must instead RESTORE the trashed row in-place: clear
        // `deleted_at`, overwrite `role` with the freshly requested
        // value, and refresh `joined_at`. The returned model must be
        // the same row (same id) and no second row may exist for the
        // (org, user) pair.
        $org = Organization::factory()->create();
        $user = User::factory()->create();

        $previous = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'role' => MembershipRole::Member,
        ]);
        $originalId = $previous->id;
        $previous->delete();

        $beforeAdd = now();
        $restored = $this->service->add($org, $user, MembershipRole::Admin);

        // Same id → it's a restore, not a fresh INSERT.
        expect($restored->id)->toBe($originalId);

        // Active again, with the new role and a fresh joined_at.
        expect($restored->trashed())->toBeFalse();
        expect($restored->deleted_at)->toBeNull();
        expect($restored->role)->toBe(MembershipRole::Admin);
        expect($restored->joined_at)->not->toBeNull();
        expect(abs($restored->joined_at->diffInSeconds($beforeAdd)))
            ->toBeLessThanOrEqual(5);

        // Exactly ONE row for (org, user) — no orphan/duplicate.
        $totalRows = Membership::withTrashed()
            ->where('organization_id', $org->id)
            ->where('user_id', $user->id)
            ->count();
        expect($totalRows)->toBe(1);
    });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('MembershipService::remove', function (): void {
    it('soft-deletes the target membership when the actor has authority', function (): void {
        $org = Organization::factory()->create();

        $owner = User::factory()->create();
        Membership::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        $this->service->remove($target, $owner);

        expect($target->fresh()->trashed())->toBeTrue();
    });

    it('rejects an actor without canManageMembers permission', function (): void {
        $org = Organization::factory()->create();

        $actor = User::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $actor->id,
        ]);

        $target = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        expect(fn () => $this->service->remove($target, $actor))
            ->toThrow(
                DomainException::class,
                'Você não tem permissão para remover este membro.',
            );

        expect($target->fresh()->trashed())->toBeFalse();
    });

    it('blocks an admin from removing a peer admin', function (): void {
        $org = Organization::factory()->create();

        $admin = User::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $peer = Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => User::factory()->create()->id,
        ]);

        expect(fn () => $this->service->remove($peer, $admin))
            ->toThrow(
                DomainException::class,
                'Você não pode remover um membro com função igual ou superior à sua.',
            );
    });
});
