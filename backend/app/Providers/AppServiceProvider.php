<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Membership;
use App\Models\Organization;
use App\Policies\MembershipPolicy;
use App\Policies\OrganizationPolicy;
use Illuminate\Support\Facades\Gate;
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
    }
}
