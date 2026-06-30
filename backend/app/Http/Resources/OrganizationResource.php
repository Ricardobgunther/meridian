<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an {@see Organization}.
 *
 * `your_role` is the calling user's role in the org (or `null` if
 * they're not a member). The value is resolved with zero extra queries
 * in three situations:
 *   - the caller supplied an explicit `$yourRole` to the constructor
 *     (preferred for single-row endpoints where the resolver already
 *     loaded the membership — see {@see \App\Http\Middleware\ResolveOrganization});
 *   - the model was loaded via `User::organizations()` and the pivot
 *     already carries `role` (listing path);
 *   - otherwise we fall back to a single `User::roleIn()` query.
 *
 * Any externally-provided string is validated through
 * {@see MembershipRole::tryFrom()} so a corrupt pivot value or an
 * unexpected constructor argument cannot leak a garbage string into
 * the JSON contract.
 *
 * @property-read Organization $resource
 */
class OrganizationResource extends JsonResource
{
    private ?string $resolvedRole;

    public function __construct(mixed $resource, MembershipRole|string|null $yourRole = null)
    {
        parent::__construct($resource);

        $this->resolvedRole = $this->normaliseRole($yourRole);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Organization $organization */
        $organization = $this->resource;

        return [
            'id' => $organization->id,
            'slug' => $organization->slug,
            'name' => $organization->name,
            'settings' => $organization->settings ?? [],
            'your_role' => $this->resolveYourRole($organization, $request->user()),
            'created_at' => $organization->created_at?->toIso8601String(),
            'updated_at' => $organization->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Resolution order: explicit constructor value → pivot value from
     * the listing path → single `roleIn()` query. Every string source
     * is funnelled through {@see MembershipRole::tryFrom()} so an
     * unknown value becomes `null` instead of leaking into the contract.
     */
    private function resolveYourRole(Organization $organization, mixed $user): ?string
    {
        if ($this->resolvedRole !== null) {
            return $this->resolvedRole;
        }

        $pivot = $organization->getAttribute('pivot');
        if ($pivot !== null) {
            $role = $pivot->getAttribute('role');
            if ($role instanceof MembershipRole) {
                return $role->value;
            }
            if (is_string($role) && $role !== '') {
                return MembershipRole::tryFrom($role)?->value;
            }
        }

        if (! $user instanceof User) {
            return null;
        }

        return $user->roleIn($organization->id)?->value;
    }

    private function normaliseRole(MembershipRole|string|null $role): ?string
    {
        if ($role instanceof MembershipRole) {
            return $role->value;
        }

        if (is_string($role) && $role !== '') {
            return MembershipRole::tryFrom($role)?->value;
        }

        return null;
    }
}
