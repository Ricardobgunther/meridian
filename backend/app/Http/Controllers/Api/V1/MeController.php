<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

/**
 * Returns the authenticated Supabase user's profile, derived from JWT claims.
 *
 * Auth is performed by the `supabase.auth` middleware, which attaches the
 * decoded claims to the request as the `supabase_user` attribute.
 */
class MeController extends Controller
{
    public function __invoke(Request $request): UserResource
    {
        /** @var array<string, mixed> $claims */
        $claims = $request->attributes->get('supabase_user', []);

        return new UserResource($claims);
    }
}
