<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreOrganizationRequest;
use App\Http\Requests\Api\V1\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP entry point for the {@see Organization} aggregate.
 *
 * Thin by design (ADR — Backend Agent rules): every non-trivial branch
 * is delegated to {@see OrganizationService}, and every authorization
 * check goes through {@see \App\Policies\OrganizationPolicy} or the
 * `org.resolve` middleware (which already gates membership before the
 * controller is reached).
 */
class OrganizationController extends Controller
{
    public function __construct(
        private readonly OrganizationService $organizations,
    ) {}

    /**
     * GET /api/v1/organizations — list the caller's organizations.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        $perPage = (int) min((int) $request->integer('per_page', 20), 100);
        $perPage = max($perPage, 1);

        $organizations = $user->organizations()
            ->orderBy('name')
            ->paginate($perPage);

        return OrganizationResource::collection($organizations);
    }

    /**
     * POST /api/v1/organizations — create a new org with the caller as
     * its sole owner (ADR-012: no auto-personal-org on signup).
     */
    public function store(StoreOrganizationRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array{name: string, slug: string, settings?: array<string, mixed>|null} $data */
        $data = $request->validated();

        $organization = $this->organizations->createWithOwner($user, $data);

        return (new OrganizationResource($organization))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/organizations/{organization} — view a single org.
     *
     * Membership is enforced by `org.resolve` before this method runs,
     * but we still call `authorize()` so the policy is the single
     * source of truth for read access.
     *
     * `org.resolve` already loaded the caller's {@see Membership} to
     * decide whether to let the request through; reusing it here means
     * `your_role` is rendered with zero additional queries — no pivot
     * fast-path, no `User::roleIn()` fallback.
     */
    public function show(Request $request, Organization $organization): OrganizationResource
    {
        $this->authorize('view', $organization);

        $membership = $request->attributes->get('current_membership');
        $yourRole = $membership instanceof Membership ? $membership->role->value : null;

        return new OrganizationResource($organization, $yourRole);
    }

    /**
     * PATCH /api/v1/organizations/{organization} — partial update.
     */
    public function update(UpdateOrganizationRequest $request, Organization $organization): OrganizationResource
    {
        $this->authorize('update', $organization);

        $organization = $this->organizations->update($organization, $request->validated());

        return new OrganizationResource($organization);
    }

    /**
     * DELETE /api/v1/organizations/{organization} — soft-delete the
     * organization and all its active memberships.
     */
    public function destroy(Request $request, Organization $organization): Response
    {
        $this->authorize('delete', $organization);

        $this->organizations->delete($organization);

        return response()->noContent();
    }
}
