<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;

/**
 * Per-row tenant scoping — ADR-008.
 *
 * Apply to any domain model whose table has an `organization_id` column.
 * It does two things:
 *
 *   1. Adds a `belongsTo(Organization::class)` relation as `organization()`.
 *   2. Registers a global Eloquent scope that filters queries by the
 *      currently-resolved organization (set by the `ResolveOrganization`
 *      middleware via `app()->instance('current_organization_id', ...)`).
 *
 * Behaviour when `current_organization_id` is not bound:
 *   - **HTTP context** (an inbound `request` is bound) → the scope
 *     **throws** a {@see RuntimeException}. Without RLS on the
 *     application connection (the API uses the service role, which
 *     bypasses RLS), this scope is the only barrier between tenants on
 *     the HTTP path; failing open would silently expose every row to
 *     every caller.
 *   - **CLI / queue context** (no `request` bound) → no-op. Background
 *     jobs and console commands legitimately operate outside of a
 *     single tenant. They must still opt in to bypassing the scope
 *     explicitly when desired, but the absence of the binding is not
 *     itself an error.
 *
 * Callers that need to escape the scope must use
 * `Model::withoutGlobalScope(BelongsToOrganizationScope::class)` or the
 * explicit `forOrganization()` scope below.
 *
 * @mixin Model
 *
 * @phpstan-require-extends Model
 */
trait BelongsToOrganization
{
    /**
     * @return BelongsTo<Organization, $this>
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Eloquent boot hook — Laravel calls this automatically.
     */
    protected static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope(new BelongsToOrganizationScope());
    }

    /**
     * Explicit override: scope to a given organization regardless of
     * the current request context. Used by admin/console code paths.
     *
     * @param  Builder<Model>  $query
     * @return Builder<Model>
     */
    public function scopeForOrganization(Builder $query, string $orgId): Builder
    {
        return $query->where($query->getModel()->qualifyColumn('organization_id'), $orgId);
    }
}

/**
 * Global scope companion for {@see BelongsToOrganization}.
 *
 * Kept in the same file because it is implementation detail of the
 * trait and not useful in isolation; this keeps the file under the
 * 150-line model limit while avoiding a one-class file.
 */
final class BelongsToOrganizationScope implements Scope
{
    /**
     * @param  Builder<Model>  $builder
     */
    public function apply(Builder $builder, Model $model): void
    {
        if (! app()->bound('current_organization_id')) {
            // In HTTP context the absence of a resolved tenant is fatal:
            // the global scope is the only barrier between tenants for
            // application-level queries (RLS is bypassed by the service
            // role). Outside HTTP (jobs, console, tests bootstrap), the
            // scope is a no-op — callers must opt in explicitly via
            // `withoutGlobalScope()` or `forOrganization()`.
            if (app()->bound('request')) {
                throw new RuntimeException(sprintf(
                    'Tenant-scoped query on %s attempted without a resolved organization. '
                    .'Add the `org.resolve` middleware to the route, or call '
                    .'`%s::withoutGlobalScope(%s::class)` if the bypass is intentional.',
                    $model::class,
                    $model::class,
                    self::class,
                ));
            }

            return;
        }

        /** @var string $orgId */
        $orgId = app('current_organization_id');

        $builder->where($model->qualifyColumn('organization_id'), $orgId);
    }
}
