<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;

/**
 * Authorization for {@see Invitation} actions — ADR-010, ADR-013.
 *
 * Only owners and admins of an organization may issue, list, resend or
 * revoke its invitations. Members and outsiders are denied.
 *
 * The accept/decline endpoints are NOT gated by this policy — they are
 * keyed by the raw token, not by the caller's role inside the org. Their
 * own controller validates the token-vs-session pairing.
 */
class InvitationPolicy
{
    /**
     * `viewAny` and `create` are org-scoped: the actor's role in that
     * org gates the action.
     */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $user->roleIn($organization->id)?->canManageMembers() === true;
    }

    public function create(User $user, Organization $organization): bool
    {
        return $user->roleIn($organization->id)?->canManageMembers() === true;
    }

    /**
     * `view`, `update`, `delete`, `resend` operate on a row — the actor
     * must hold an admin+ role in the row's organization. We deliberately
     * do NOT also require "actor outranks invitation role" here because
     * invitations never carry `owner` (ADR-013 forbids it) and the
     * "admin cannot edit another admin" rule we apply to memberships
     * makes no sense for an unaccepted invitation that has no human
     * attached to it yet.
     */
    public function view(User $user, Invitation $invitation): bool
    {
        return $user->roleIn($invitation->organization_id)?->canManageMembers() === true;
    }

    public function update(User $user, Invitation $invitation): bool
    {
        return $this->view($user, $invitation);
    }

    public function delete(User $user, Invitation $invitation): bool
    {
        return $this->view($user, $invitation);
    }

    public function resend(User $user, Invitation $invitation): bool
    {
        return $this->view($user, $invitation);
    }
}
