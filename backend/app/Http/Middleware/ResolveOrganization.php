<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active organization for the current request — ADR-009.
 *
 * Must run AFTER `supabase.auth` so `$request->user()` is the locally
 * provisioned {@see User} row. Resolves the org id from one of two
 * sources (in this order):
 *
 *   1. The `{organization}` route parameter, when the route is bound
 *      to an {@see Organization} model. Accepting it here lets
 *      `/organizations/{organization}/...` routes reuse the same
 *      authorization pipeline without forcing clients to also send a
 *      redundant header.
 *   2. The `X-Organization-Id` request header. Used by top-level
 *      endpoints (e.g. listings that target the "current" org) where
 *      no organization is present in the URL.
 *
 * In both cases, the user must hold an active (non-soft-deleted)
 * membership in the org or the request is rejected. On success, the
 * resolved id is bound into the container as `current_organization_id`
 * so the global tenant scope (see
 * {@see \App\Models\Concerns\BelongsToOrganization}) can apply
 * automatically, and the {@see Organization} + {@see Membership}
 * models are attached to the request attributes.
 */
class ResolveOrganization
{
    private const HEADER = 'X-Organization-Id';

    private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    public function handle(Request $request, Closure $next): Response
    {
        $orgId = $this->resolveOrgId($request);

        if ($orgId === null) {
            return $this->error('Cabeçalho X-Organization-Id é obrigatório.', Response::HTTP_BAD_REQUEST);
        }

        if (preg_match(self::UUID_PATTERN, $orgId) !== 1) {
            return $this->error('ID de organização inválido.', Response::HTTP_BAD_REQUEST);
        }

        $user = $request->user();

        if (! $user instanceof User) {
            // supabase.auth should always run first; if it didn't, this
            // is a routing misconfiguration rather than user error.
            return $this->error('Não autenticado.', Response::HTTP_UNAUTHORIZED);
        }

        /** @var Membership|null $membership */
        $membership = Membership::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $orgId)
            ->whereNull('deleted_at')
            ->with('organization')
            ->first();

        if ($membership === null) {
            return $this->error('Você não tem acesso a esta organização.', Response::HTTP_FORBIDDEN);
        }

        app()->instance('current_organization_id', $membership->organization_id);
        $request->attributes->set('current_organization', $membership->organization);
        $request->attributes->set('current_membership', $membership);

        return $next($request);
    }

    /**
     * Picks the org id from the route binding when present, otherwise
     * falls back to the `X-Organization-Id` header.
     *
     * Accepts both an already-resolved {@see Organization} model (the
     * normal case once route-model binding has run) and a raw uuid
     * string (when the middleware fires before binding).
     */
    private function resolveOrgId(Request $request): ?string
    {
        $route = $request->route();

        if ($route !== null) {
            $param = $route->parameter('organization');

            if ($param instanceof Organization) {
                return $param->getKey();
            }

            if (is_string($param) && $param !== '') {
                return $param;
            }
        }

        $header = $request->header(self::HEADER);

        if (is_string($header) && $header !== '') {
            return $header;
        }

        return null;
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['error' => $message], $status);
    }
}
