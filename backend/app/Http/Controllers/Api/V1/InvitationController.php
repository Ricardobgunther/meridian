<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ListInvitationsRequest;
use App\Http\Requests\Api\V1\StoreInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP entry point for org-scoped invitation actions — `index`, `store`,
 * `destroy`, `resend`.
 *
 * The accept/decline flow (which is keyed by raw token, not by org
 * membership) lives in {@see AcceptInvitationController}.
 *
 * Tenancy: the `org.resolve` middleware on the route group has already
 * confirmed the caller's active membership in the active organization
 * (resolved from `X-Organization-Id`). Authorization beyond "member of
 * the org" — i.e. "owner or admin" — lives in {@see \App\Policies\InvitationPolicy}.
 */
class InvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    /**
     * GET /api/v1/invitations — paginated listing for the active org.
     *
     * Defaults: `status=pending` (the admin UI default). Pass `status=all`
     * to remove the filter. Search is a case-insensitive prefix/contains
     * match on the email column.
     */
    public function index(ListInvitationsRequest $request): AnonymousResourceCollection
    {
        /** @var Organization $organization */
        $organization = $request->attributes->get('current_organization');

        $this->authorize('viewAny', [Invitation::class, $organization]);

        /** @var array{status?: string|null, per_page?: int|null, page?: int|null, search?: string|null} $validated */
        $validated = $request->validated();

        $perPage = max(1, min((int) ($validated['per_page'] ?? 20), 100));
        $status = $validated['status'] ?? InvitationStatus::Pending->value;
        $search = isset($validated['search']) ? trim((string) $validated['search']) : '';
        $search = $search !== '' ? mb_strtolower($search) : null;

        $query = Invitation::query()
            ->where('organization_id', $organization->id)
            ->whereNull('invitations.deleted_at')
            ->with(['invitedBy']);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($search !== null) {
            $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search).'%';
            $query->where(function (Builder $w) use ($like): void {
                $w->whereRaw("LOWER(email) LIKE ? ESCAPE '\\'", [$like]);
            });
        }

        $page = $query->orderByDesc('created_at')->paginate($perPage);

        return InvitationResource::collection($page);
    }

    /**
     * POST /api/v1/invitations — create a new invitation.
     *
     * The service does the heavy lifting (rate limit, dup check, token
     * mint, email send, DB write — all inside a transaction). Domain
     * failures (already-member, already-pending, rate-limit) bubble up
     * as {@see \App\Exceptions\Domain\InvitationException} and render
     * themselves to the appropriate `{ error, code }` JSON.
     */
    public function store(StoreInvitationRequest $request): JsonResponse
    {
        /** @var Organization $organization */
        $organization = $request->attributes->get('current_organization');

        $this->authorize('create', [Invitation::class, $organization]);

        /** @var User $inviter */
        $inviter = $request->user();

        /** @var array{email: string, role: string} $data */
        $data = $request->validated();

        $result = $this->invitations->invite(
            $organization,
            $inviter,
            $data['email'],
            MembershipRole::from($data['role']),
        );

        return (new InvitationResource($result['invitation']))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * DELETE /api/v1/invitations/{invitation} — revoke. Idempotent.
     */
    public function destroy(Invitation $invitation): Response
    {
        $this->authorize('delete', $invitation);

        $this->invitations->revoke($invitation);

        return response()->noContent();
    }

    /**
     * POST /api/v1/invitations/{invitation}/resend — regenerate token,
     * reset expires_at, fire a new email. Returns the updated row.
     */
    public function resend(Invitation $invitation): JsonResource
    {
        $this->authorize('resend', $invitation);

        $result = $this->invitations->resend($invitation);

        return new InvitationResource($result['invitation']);
    }
}
