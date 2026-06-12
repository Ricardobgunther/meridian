<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AcceptInvitationController;
use App\Http\Controllers\Api\V1\CheckOrganizationSlugController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\LeaveOrganizationController;
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
        default => throw new RuntimeException(
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
| We cannot read the resolved `current_organization_id` here (it isn't set
| until `org.resolve` runs, after this bind), but we CAN read the raw
| `X-Organization-Id` header off the request — the same source
| `org.resolve` uses. Scoping the bind by that header makes a cross-tenant
| id 404 at the binding layer (same UX as `{member}`) instead of leaking
| the row's existence via a 403 from the policy:
|   - Header = attacker's own org + a foreign invitation id → the org
|     filter misses → 404. The foreign row's existence is never confirmed.
|   - Header = a foreign org the attacker doesn't belong to → the bind may
|     match, but `org.resolve` then 403s on "no membership in that org",
|     which only reveals org-membership status, not invitation existence.
|
| When the header is absent/blank we leave the query unscoped: `org.resolve`
| rejects the request with 400 ("header obrigatório") before the controller
| runs, so no existence signal escapes regardless of whether the bind matched.
|
*/
Route::bind('invitation', function (string $id): Invitation {
    $orgId = request()->header('X-Organization-Id');

    $query = Invitation::query()
        ->whereKey($id)
        ->whereNull('deleted_at');

    if (is_string($orgId) && $orgId !== '') {
        $query->where('organization_id', $orgId);
    }

    return $query->firstOrFail();
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

        // Advisory slug-availability preview for the create-org form.
        // ORDERING MATTERS: this path has the same segment count as
        // `/organizations/{organization}`, so it MUST be registered
        // before that wildcard route or "check-slug" would be captured
        // as an organization id. The named `check_slug` limiter
        // (30/min/user, AppServiceProvider) layers on top of the group's
        // 60/min — same defence-in-depth pattern as `accept_invitation`.
        Route::get('/organizations/check-slug', CheckOrganizationSlugController::class)
            ->middleware('throttle:check_slug')
            ->name('v1.organizations.check-slug');

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

            // Self-removal ("leave"). A verb route, mirroring the
            // `/invitations/{invitation}/resend` precedent, instead of a
            // magic `me` literal on the `{member}` binding.
            Route::post('/organizations/{organization}/leave', LeaveOrganizationController::class)
                ->name('v1.organizations.leave');

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
            // `{invitation}` bind scopes to that same header so cross-tenant
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
| The token travels in the `X-Invitation-Token` HEADER, never in the path
| (follow-up R10): a path-param is a bearer credential captured by every
| access log / APM by default, while a header is not. The controller reads
| and shape-checks the header. The route paths are now static, so the
| GET preview MUST be non-cacheable (the controller sends Cache-Control:
| no-store) or an intermediary keyed on URL alone would cross-serve tokens.
|
*/
Route::prefix('v1/invitations/accept')
    ->middleware('throttle:60,1')
    ->group(function (): void {
        // Public preview — does NOT consume the token. Returns 200 with
        // a discriminated `status` payload for every case (including
        // not_found / expired) to flatten the enumeration surface.
        Route::get('/', [AcceptInvitationController::class, 'show'])
            ->name('v1.invitations.accept.show');

        // Auth-required: accept and decline. We attach supabase.auth
        // individually here so the GET above stays public. The named
        // `accept_invitation` limiter (10/min/IP, registered in
        // AppServiceProvider) layers on top of the 60/min prefix throttle —
        // defence-in-depth for the token-consuming POSTs (R5); the tighter
        // 10/min wins for them.
        Route::middleware(['supabase.auth', 'throttle:accept_invitation'])->group(function (): void {
            Route::post('/', [AcceptInvitationController::class, 'store'])
                ->name('v1.invitations.accept.store');

            Route::post('/decline', [AcceptInvitationController::class, 'destroy'])
                ->name('v1.invitations.accept.decline');
        });
    });
