<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use App\Policies\InvitationPolicy;
use App\Policies\MembershipPolicy;
use App\Policies\OrganizationPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * Laravel 11 dropped `AuthServiceProvider`; policies are registered
     * here explicitly to avoid relying on Laravel's auto-discovery
     * (which is namespace-based and silently fails on rename/move).
     */
    public function boot(): void
    {
        Gate::policy(Organization::class, OrganizationPolicy::class);
        Gate::policy(Membership::class, MembershipPolicy::class);
        Gate::policy(Invitation::class, InvitationPolicy::class);

        // Defence-in-depth throttle for the auth-required accept/decline
        // POSTs — follow-up R5. Tighter than the 60/min prefix throttle so a
        // signed-in caller cannot hammer the token-consumption endpoints.
        RateLimiter::for('accept_invitation', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Per-keystroke (debounced) slug availability checks get their
        // own bucket so a user typing a slug does not also need to fit
        // inside the general 60/min v1 budget shape. Keyed by IP: Laravel's
        // middleware priority runs ThrottleRequests BEFORE
        // VerifySupabaseToken, so `$request->user()` is always null here —
        // per-user keying would require reordering the global middleware
        // priority, not worth it for an advisory endpoint. Users behind a
        // shared NAT split one bucket; acceptable because a 429 degrades
        // silently on the client. 30/min ≈ one check every 2s sustained:
        // generous for a 400ms-debounced field.
        RateLimiter::for('check_slug', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
    }
}
