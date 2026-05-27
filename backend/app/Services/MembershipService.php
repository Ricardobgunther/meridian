<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\MembershipRole;
use App\Exceptions\Domain\LoneOwnerException;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use DomainException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Use cases for the {@see Membership} aggregate.
 *
 * Business invariants (lone-owner protection, no API-driven ownership
 * transfer, no self-elevation past one's own rank) live here so they
 * apply uniformly whether the call comes from HTTP, a queue job, or a
 * future internal admin tool.
 */
class MembershipService
{
    /**
     * Add a new active membership for `$user` in `$organization`.
     *
     * The DB unique index `uniq_memberships_org_user` spans ALL rows
     * (including soft-deleted ones), so a naive INSERT after a prior
     * soft-delete would collide and surface a {@see \Illuminate\Database\QueryException}
     * as HTTP 500. To keep the unique invariant intact and still support
     * the common "removed last week, want them back today" flow, this
     * method disambiguates the three cases atomically:
     *
     *   - ACTIVE row already exists → throw {@see DomainException}.
     *   - SOFT-DELETED row exists → restore it: clear `deleted_at`,
     *     overwrite `role` with the freshly requested value, refresh
     *     `joined_at` to `now()`, save.
     *   - NO row → insert a new one.
     *
     * @throws DomainException When the user already has an active
     *                          membership in the organization.
     */
    public function add(Organization $organization, User $user, MembershipRole $role): Membership
    {
        return DB::transaction(function () use ($organization, $user, $role): Membership {
            $existing = Membership::withTrashed()
                ->where('organization_id', $organization->id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($existing !== null && ! $existing->trashed()) {
                throw new DomainException('Este usuário já é membro da organização.');
            }

            if ($existing !== null) {
                // Soft-deleted prior membership: restore it. Resetting
                // `deleted_at`, `role` and `joined_at` produces the same
                // observable state as a fresh INSERT, but reuses the row
                // so the unique index is not violated.
                $existing->deleted_at = null;
                $existing->role = $role;
                $existing->joined_at = Carbon::now();
                $existing->save();

                return $existing->refresh();
            }

            return Membership::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'role' => $role->value,
                'joined_at' => Carbon::now(),
            ]);
        });
    }

    /**
     * Change a member's role.
     *
     * Invariants enforced here (rather than in the Form Request) so
     * they apply to every call site:
     *  - the actor must strictly outrank the target's CURRENT role,
     *    unless the actor is the owner (owners may edit other owners);
     *  - the new role cannot be `owner` (ownership transfer is a
     *    separate, future flow);
     *  - if the target is the sole owner, demoting them is rejected
     *    with {@see LoneOwnerException}.
     *
     * @throws LoneOwnerException
     * @throws DomainException
     */
    public function changeRole(Membership $member, MembershipRole $newRole, User $actor): Membership
    {
        if ($newRole === MembershipRole::Owner) {
            throw new DomainException('Não é possível promover um membro a owner por esta rota.');
        }

        return DB::transaction(function () use ($member, $newRole, $actor): Membership {
            $member->refresh();

            $actorRole = $actor->roleIn($member->organization_id);

            if ($actorRole === null || ! $actorRole->canManageMembers()) {
                throw new DomainException('Você não tem permissão para alterar este membro.');
            }

            if ($actorRole !== MembershipRole::Owner && ! $actorRole->outranks($member->role)) {
                throw new DomainException('Você não pode alterar um membro com função igual ou superior à sua.');
            }

            // $newRole was guaranteed non-owner by the top-of-method
            // guard, so demoting an existing owner is the only way to
            // hit the lone-owner guard here.
            if ($member->role === MembershipRole::Owner) {
                $this->guardLastOwner($member);
            }

            $member->role = $newRole;
            $member->save();

            return $member->refresh();
        });
    }

    /**
     * Soft-delete a membership.
     *
     * Same authorization checks as {@see self::changeRole()} apply,
     * plus the lone-owner guard so removing the only owner is rejected
     * with {@see LoneOwnerException}.
     *
     * @throws LoneOwnerException
     * @throws DomainException
     */
    public function remove(Membership $member, User $actor): void
    {
        DB::transaction(function () use ($member, $actor): void {
            $member->refresh();

            $actorRole = $actor->roleIn($member->organization_id);

            if ($actorRole === null || ! $actorRole->canManageMembers()) {
                throw new DomainException('Você não tem permissão para remover este membro.');
            }

            if ($actorRole !== MembershipRole::Owner && ! $actorRole->outranks($member->role)) {
                throw new DomainException('Você não pode remover um membro com função igual ou superior à sua.');
            }

            if ($member->role === MembershipRole::Owner) {
                $this->guardLastOwner($member);
            }

            $member->delete();
        });
    }

    /**
     * Rejects an operation that would leave `$member`'s organization
     * without any active owner. Counts active owner memberships other
     * than `$member` itself; if none, refuses the operation.
     */
    private function guardLastOwner(Membership $member): void
    {
        $remainingOwners = Membership::query()
            ->where('organization_id', $member->organization_id)
            ->where('role', MembershipRole::Owner->value)
            ->where('id', '!=', $member->id)
            ->whereNull('deleted_at')
            ->count();

        if ($remainingOwners === 0) {
            throw new LoneOwnerException();
        }
    }
}
