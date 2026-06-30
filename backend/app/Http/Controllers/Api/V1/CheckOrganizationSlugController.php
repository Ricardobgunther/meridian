<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CheckOrganizationSlugRequest;
use App\Services\OrganizationService;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/organizations/check-slug?slug={slug} — advisory live
 * availability preview for the create-organization form.
 *
 * Sibling of `GET /organizations` (no `org.resolve`: no tenant context
 * is needed) but auth-required so anonymous traffic cannot enumerate
 * slugs. Availability semantics are delegated to
 * {@see OrganizationService::isSlugAvailable()}, which mirrors the
 * uniqueness rule of `POST /organizations` exactly.
 *
 * `Cache-Control: no-store`: the verdict is per-keystroke and goes
 * stale immediately — an intermediary replaying a cached `available:
 * true` would contradict the authoritative 422 from the POST.
 */
class CheckOrganizationSlugController extends Controller
{
    public function __construct(
        private readonly OrganizationService $organizations,
    ) {}

    public function __invoke(CheckOrganizationSlugRequest $request): JsonResponse
    {
        $slug = (string) $request->validated('slug');

        return response()
            ->json([
                'data' => [
                    'slug' => $slug,
                    'available' => $this->organizations->isSlugAvailable($slug),
                ],
            ])
            ->header('Cache-Control', 'no-store');
    }
}
