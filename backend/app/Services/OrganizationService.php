<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Use cases for the {@see Organization} aggregate.
 *
 * Every method that touches more than one row runs inside a
 * `DB::transaction()` so partial state never leaks (e.g. an org
 * created without its founding membership, or a soft-deleted org
 * whose memberships still appear active in `/me`).
 */
class OrganizationService
{
    /**
     * Create a new organization with the caller as its sole owner.
     *
     * @param  array{name: string, slug: string, settings?: array<string, mixed>|null}  $data
     */
    public function createWithOwner(User $owner, array $data): Organization
    {
        return DB::transaction(function () use ($owner, $data): Organization {
            $organization = Organization::create([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'settings' => $data['settings'] ?? [],
                'created_by' => $owner->id,
            ]);

            Membership::create([
                'organization_id' => $organization->id,
                'user_id' => $owner->id,
                'role' => MembershipRole::Owner->value,
                'joined_at' => Carbon::now(),
            ]);

            return $organization->refresh();
        });
    }

    /**
     * Apply a partial update to an organization. Only the keys present
     * in `$data` are written, so callers can safely pass through
     * `$request->validated()` from a `sometimes`-based Form Request.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Organization $organization, array $data): Organization
    {
        $organization->fill($data)->save();

        return $organization->refresh();
    }

    /**
     * Soft-delete the organization and all of its active memberships
     * in the same transaction so users don't see a "ghost" org via
     * stale membership rows in `/me` or `/organizations`.
     */
    public function delete(Organization $organization): void
    {
        DB::transaction(function () use ($organization): void {
            $organization->memberships()->whereNull('deleted_at')->delete();
            $organization->delete();
        });
    }
}
