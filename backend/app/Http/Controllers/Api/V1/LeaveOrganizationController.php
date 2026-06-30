<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\Domain\LoneOwnerException;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use App\Services\MembershipService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * POST /api/v1/organizations/{organization}/leave — the caller removes
 * their OWN membership.
 *
 * A verb route (precedent: `POST /invitations/{id}/resend`) instead of a
 * magic `me` literal on `DELETE /members/{member}`. Deliberately NOT the
 * same use case as removing a member: see
 * {@see MembershipService::leave()} for why the remove() invariants must
 * not be relaxed for the self-case.
 *
 * Pipeline:
 *  - `org.resolve` guarantees the org exists, is not soft-deleted, and
 *    the caller holds an active membership (404/403 otherwise);
 *  - `OrganizationPolicy::leave()` re-states "any active member may
 *    leave" so the policy stays the single source of truth;
 *  - the service enforces lone-owner protection —
 *    {@see LoneOwnerException} is rendered to
 *    `422 { error, code: "lone_owner" }` by the handler in
 *    `bootstrap/app.php`.
 *
 * No request body, hence no Form Request: there is nothing to validate.
 */
class LeaveOrganizationController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
    ) {}

    public function __invoke(Request $request, Organization $organization): Response
    {
        $this->authorize('leave', $organization);

        /** @var User $user */
        $user = $request->user();

        $this->memberships->leave($organization, $user);

        return response()->noContent();
    }
}
