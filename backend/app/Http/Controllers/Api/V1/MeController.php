<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Returns the authenticated user's profile plus the organizations they
 * currently belong to.
 *
 * Auth is performed by the `supabase.auth` middleware, which validates
 * the JWT and lazy-provisions the local `users` row (ADR-011), then
 * attaches the model via `$request->user()`.
 */
class MeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $memberships = $user
            ->memberships()
            ->with('organization')
            ->whereNull('memberships.deleted_at')
            ->orderBy('joined_at')
            ->get();

        return response()->json([
            'data' => (new UserResource($user))->toArray($request),
            'memberships' => MembershipResource::collection($memberships)->toArray($request),
        ]);
    }
}
