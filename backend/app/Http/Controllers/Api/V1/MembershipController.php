<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListMembershipsRequest;
use App\Http\Requests\Api\V1\StoreMembershipRequest;
use App\Http\Requests\Api\V1\UpdateMembershipRequest;
use App\Http\Resources\MembershipResource;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Services\MembershipService;
use DomainException;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP entry point for managing members of an organization.
 *
 * The `{organization}` route binding plus the `org.resolve` middleware
 * guarantee:
 *   - the org exists and is not soft-deleted;
 *   - the caller has an active membership in that org.
 *
 * Cross-tenant access on `{member}` is prevented at the route binding
 * layer (see `routes/api.php`): a membership id that does not belong to
 * the `{organization}` in the URL — or that is soft-deleted — is 404'd
 * before the controller is invoked. There is no defence-in-depth check
 * in this class on purpose; centralising the scoping rule keeps the
 * "cross-tenant id" failure mode in one place.
 *
 * Anything stronger (admin+ to modify, lone-owner protection, etc.)
 * lives in {@see \App\Policies\MembershipPolicy} and
 * {@see MembershipService}.
 */
class MembershipController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
    ) {}

    /**
     * GET /api/v1/organizations/{organization}/members — paginated list.
     *
     * Accepts `q` (free-text match on the user's name/email), `role`
     * (one of `owner|admin|member`), and standard `per_page` / `page`
     * pagination. Filters are validated in
     * {@see ListMembershipsRequest}; this method only assembles the
     * query.
     */
    public function index(ListMembershipsRequest $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Membership::class, $organization]);

        /** @var array{q?: string|null, role?: string|null, per_page?: int|null, page?: int|null} $validated */
        $validated = $request->validated();

        $perPage = (int) ($validated['per_page'] ?? 20);
        $perPage = max(1, min($perPage, 100));

        $role = isset($validated['role']) && $validated['role'] !== ''
            ? $validated['role']
            : null;

        $q = isset($validated['q']) ? trim((string) $validated['q']) : '';
        $q = $q !== '' ? mb_strtolower($q) : null;

        $query = Membership::query()
            ->where('organization_id', $organization->id)
            ->whereNull('memberships.deleted_at')
            ->with(['user', 'organization']);

        if ($role !== null) {
            $query->where('role', $role);
        }

        if ($q !== null) {
            // Postgres' LIKE is case-sensitive while SQLite's is ASCII-
            // case-insensitive — relying on engine-native behaviour
            // would give green tests and a broken production search. We
            // always lowercase both sides ($q was lowercased above;
            // LOWER() is applied to the column) and escape literal
            // wildcards in the user input so e.g. a search for "50%"
            // matches the literal string instead of acting as a
            // wildcard. The ESCAPE clause is required because SQLite's
            // LIKE does not honour an escape char by default — Postgres
            // does, but being explicit makes both engines behave the
            // same way.
            $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q).'%';
            $query->whereHas('user', function (Builder $u) use ($like): void {
                $u->where(function (Builder $w) use ($like): void {
                    $w->whereRaw("LOWER(name) LIKE ? ESCAPE '\\'", [$like])
                        ->orWhereRaw("LOWER(email) LIKE ? ESCAPE '\\'", [$like]);
                });
            });
        }

        $members = $query->orderBy('joined_at')->paginate($perPage);

        return MembershipResource::collection($members);
    }

    /**
     * POST /api/v1/organizations/{organization}/members — direct-add by
     * user id. Invite-by-email is a separate, future flow.
     */
    public function store(StoreMembershipRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Membership::class, $organization]);

        $validated = $request->validated();

        $user = User::query()
            ->whereKey($validated['user_id'])
            ->whereNull('deleted_at')
            ->firstOrFail();

        $role = isset($validated['role'])
            ? MembershipRole::from($validated['role'])
            : MembershipRole::Member;

        try {
            $membership = $this->memberships->add($organization, $user, $role);
        } catch (DomainException $e) {
            return response()->json(['error' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $membership->load(['user', 'organization']);

        return (new MembershipResource($membership))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * PATCH /api/v1/organizations/{organization}/members/{member} —
     * change role. The service enforces "cannot demote higher rank",
     * "cannot grant owner via API" and the lone-owner guard.
     */
    public function update(
        UpdateMembershipRequest $request,
        Organization $organization,
        Membership $member,
    ): JsonResponse|MembershipResource {
        $this->authorize('update', $member);

        /** @var User $actor */
        $actor = $request->user();

        try {
            $member = $this->memberships->changeRole(
                $member,
                MembershipRole::from($request->validated('role')),
                $actor,
            );
        } catch (DomainException $e) {
            return response()->json(['error' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $member->load(['user', 'organization']);

        return new MembershipResource($member);
    }

    /**
     * DELETE /api/v1/organizations/{organization}/members/{member} —
     * remove a member. Lone-owner protection lives in the service.
     */
    public function destroy(
        Request $request,
        Organization $organization,
        Membership $member,
    ): Response|JsonResponse {
        $this->authorize('delete', $member);

        /** @var User $actor */
        $actor = $request->user();

        try {
            $this->memberships->remove($member, $actor);
        } catch (DomainException $e) {
            return response()->json(['error' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->noContent();
    }
}
