<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;

/**
 * Authorization for {@see Membership} actions — ADR-010.
 *
 * `viewAny` and `create` operate against an {@see Organization}
 * (the actor's role inside that org gates the action). `update`
 * and `delete` operate against a target {@see Membership} — we
 * additionally require that the actor outranks the target so an
 * admin cannot edit another admin or the owner.
 */
class MembershipPolicy
{
    /**
     * Any active member of the organization may list the roster.
     */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $user->belongsToOrganization($organization->id);
    }

    /**
     * Owners and admins may add new members.
     */
    public function create(User $user, Organization $organization): bool
    {
        return $user->roleIn($organization->id)?->canManageMembers() === true;
    }

    /**
     * Update or delete a target membership.
     *
     * - The actor must hold an admin+ role in the same org.
     * - The actor's role must strictly outrank the target's role,
     *   OR the actor is the owner (owners are top of the hierarchy
     *   but never strictly outrank themselves; the owner is still
     *   allowed to act on other owners, e.g. removing a co-owner).
     */
    public function update(User $user, Membership $member): bool
    {
        $actorRole = $user->roleIn($member->organization_id);

        if ($actorRole === null || ! $actorRole->canManageMembers()) {
            return false;
        }

        if ($actorRole === MembershipRole::Owner) {
            return true;
        }

        return $actorRole->outranks($member->role);
    }

    public function delete(User $user, Membership $member): bool
    {
        return $this->update($user, $member);
    }
}
