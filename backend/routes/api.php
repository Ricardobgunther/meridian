<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AcceptInvitationController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\MembershipController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Route model bindings
|--------------------------------------------------------------------------
|
| Cross-tenant access protection: `{member}` is bound *scoped to* the
| `{organization}` parameter, so requests like
| `/organizations/{A}/members/{B-member}` are 404'd at the binding layer
| — before any controller / policy code runs. This makes the cross-tenant
| bypass structurally impossible rather than dependent on the controller
| remembering to call a guard helper. Soft-deleted memberships are also
| filtered here so they never leak into authenticated paths.
|
*/
Route::bind('member', function (string $id, $route): Membership {
    $org = $route->parameter('organization');

    // Depending on parameter resolution order, `$org` may already be
    // resolved to the `Organization` model OR still be the raw uuid
    // string from the URL. Handle both. Anything else is a routing
    // misconfiguration and must fail loud — silently skipping the
    // `organization_id` filter would defeat the entire point of this
    // bind and reintroduce the cross-tenant IDOR we just fixed.
    $orgId = match (true) {
        $org instanceof Organization => $org->id,
        is_string($org) && $org !== '' => $org,
        default => throw new \RuntimeException(
            'Route bind for {member} requires an {organization} parameter; '
            .'the route is misconfigured.'
        ),
    };

    return Membership::query()
        ->whereKey($id)
        ->where('organization_id', $orgId)
        ->whereNull('deleted_at')
        ->firstOrFail();
});

/*
|--------------------------------------------------------------------------
| Invitation route-model binding
|--------------------------------------------------------------------------
|
| Unlike `{member}` (whose org context lives in the URL), `{invitation}`'s
| org context lives in the `X-Organization-Id` header. Laravel's
| `SubstituteBindings` middleware runs as part of the `api` middleware
| group — BEFORE our route-level `org.resolve`. That ordering means a
| bind closure cannot rely on `current_organization_id` being set when it
| fires.
|
| Solution split in two:
|   - The bind closure only does a soft-delete filter + id match. A
|     non-existent id 404's at the binding layer (same UX as members).
|   - Cross-tenant safety is enforced in {@see \App\Http\Controllers\Api\V1\InvitationController}
|     via {@see \App\Policies\InvitationPolicy} — the policy checks
|     "actor's role in the invitation's org" and rejects when the user
|     isn't an admin of THAT org. The user is never an admin of an org
|     they don't belong to, so cross-tenant access becomes a 403.
|
| Note: 403 (vs the 404 used for `{member}`) is a deliberate trade-off
| here. To get 404 we'd need to reorder the middleware stack so
| `org.resolve` runs before `SubstituteBindings`, which is a global
| change with ripple effects. 403 is also a defensible answer to
| "you're poking at a row that isn't yours" and matches what RLS would
| emit at the DB layer.
|
*/
Route::bind('invitation', function (string $id): Invitation {
    return Invitation::query()
        ->whereKey($id)
        ->whereNull('deleted_at')
        ->firstOrFail();
});

/*
|--------------------------------------------------------------------------
| API v1 routes
|--------------------------------------------------------------------------
|
| All endpoints are versioned under `/api/v1/` (ADR-004) and authenticated
| via the `supabase.auth` middleware (ADR-007). Tenant-scoped endpoints
| go through the additional `org.resolve` middleware (ADR-009), which
| accepts either the `X-Organization-Id` header OR the `{organization}`
| route binding — see `App\Http\Middleware\ResolveOrganization`.
|
*/

Route::prefix('v1')
    ->middleware(['supabase.auth', 'throttle:60,1'])
    ->group(function (): void {
        Route::get('/me', MeController::class)->name('v1.me');

        // Top-level organization endpoints — listing the caller's orgs
        // and creating a new one. These do NOT go through org.resolve
        // because they operate outside any one tenant.
        Route::get('/organizations', [OrganizationController::class, 'index'])
            ->name('v1.organizations.index');
        Route::post('/organizations', [OrganizationController::class, 'store'])
            ->name('v1.organizations.store');

        // Per-organization endpoints. `org.resolve` reads the
        // `{organization}` route parameter and validates the caller's
        // active membership before the controller runs.
        Route::middleware('org.resolve')->group(function (): void {
            Route::get('/organizations/{organization}', [OrganizationController::class, 'show'])
                ->name('v1.organizations.show');
            Route::patch('/organizations/{organization}', [OrganizationController::class, 'update'])
                ->name('v1.organizations.update');
            Route::delete('/organizations/{organization}', [OrganizationController::class, 'destroy'])
                ->name('v1.organizations.destroy');

            Route::get('/organizations/{organization}/members', [MembershipController::class, 'index'])
                ->name('v1.organizations.members.index');
            Route::post('/organizations/{organization}/members', [MembershipController::class, 'store'])
                ->name('v1.organizations.members.store');
            Route::patch('/organizations/{organization}/members/{member}', [MembershipController::class, 'update'])
                ->name('v1.organizations.members.update');
            Route::delete('/organizations/{organization}/members/{member}', [MembershipController::class, 'destroy'])
                ->name('v1.organizations.members.destroy');

            // ── Invitations (admin-facing) ──────────────────────────
            // Active org is resolved from `X-Organization-Id`; the
            // `{invitation}` bind scopes to that org so cross-tenant
            // ids 404 at the binding layer (same pattern as `{member}`).
            Route::get('/invitations', [InvitationController::class, 'index'])
                ->name('v1.invitations.index');
            Route::post('/invitations', [InvitationController::class, 'store'])
                ->name('v1.invitations.store');
            Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy'])
                ->name('v1.invitations.destroy');
            Route::post('/invitations/{invitation}/resend', [InvitationController::class, 'resend'])
                ->name('v1.invitations.resend');
        });
    });

/*
|--------------------------------------------------------------------------
| Invitation accept-by-token endpoints
|--------------------------------------------------------------------------
|
| These routes are deliberately OUTSIDE the `v1` group above for two
| reasons:
|   1. The GET preview is PUBLIC — no `supabase.auth`. We use a tighter
|      throttle to compensate (60/min by IP).
|   2. None of the three use `org.resolve` — the token IS the org scope.
|
| The POST endpoints still require auth (the user must be signed in to
| accept/decline), but they do NOT carry the `X-Organization-Id` header
| because the invitee has no org context yet.
|
*/
Route::prefix('v1/invitations/accept')
    ->middleware('throttle:60,1')
    ->group(function (): void {
        // Public preview — does NOT consume the token. Returns 200 with
        // a discriminated `status` payload for every case (including
        // not_found / expired) to flatten the enumeration surface.
        Route::get('/{token}', [AcceptInvitationController::class, 'show'])
            ->where('token', '[A-Za-z0-9_-]{16,128}')
            ->name('v1.invitations.accept.show');

        // Auth-required: accept and decline. We attach supabase.auth
        // individually here so the GET above stays public.
        Route::middleware('supabase.auth')->group(function (): void {
            Route::post('/{token}', [AcceptInvitationController::class, 'store'])
                ->where('token', '[A-Za-z0-9_-]{16,128}')
                ->name('v1.invitations.accept.store');

            Route::post('/{token}/decline', [AcceptInvitationController::class, 'destroy'])
                ->where('token', '[A-Za-z0-9_-]{16,128}')
                ->name('v1.invitations.accept.decline');
        });
    });
