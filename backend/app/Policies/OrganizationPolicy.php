<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

/**
 * Authorization for {@see Organization} actions — ADR-010.
 *
 * Membership is the gate: a user can only see/modify an org they hold
 * an active membership in. Role hierarchy (owner > admin > member)
 * determines the allowed verb.
 */
class OrganizationPolicy
{
    /**
     * Any active member of the organization may view it.
     */
    public function view(User $user, Organization $organization): bool
    {
        return $user->belongsToOrganization($organization->id);
    }

    /**
     * Only owners and admins may rename/reslug the organization or
     * change its settings.
     */
    public function update(User $user, Organization $organization): bool
    {
        return $user->roleIn($organization->id)?->canManageMembers() === true;
    }

    /**
     * Only the owner role may soft-delete the organization.
     * Admins manage members; they do not delete the tenant root.
     */
    public function delete(User $user, Organization $organization): bool
    {
        return $user->roleIn($organization->id)?->canDeleteOrganization() === true;
    }
}
