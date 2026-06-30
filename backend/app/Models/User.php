<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MembershipRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Local mirror of a Supabase auth user — ADR-011.
 *
 * `id` is a UUID equal to the Supabase JWT `sub` claim (`auth.uid()`),
 * so we deliberately do NOT use `HasUuids` here — the value is provided
 * by {@see \App\Services\Auth\UserProvisioningService}, never generated
 * locally.
 *
 * There is no `password` column: Supabase is the single source of truth
 * for credentials. The `Authenticatable` base class is kept only so
 * Laravel's auth scaffolding (request->user(), policies) keeps working.
 *
 * @property string $id
 * @property string $email
 * @property string|null $name
 * @property string|null $avatar_url
 * @property string $locale
 * @property string $timezone
 * @property \Illuminate\Support\Carbon|null $last_seen_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory;

    use Notifiable;
    use SoftDeletes;

    /**
     * UUID PK, never autoincremented.
     */
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'email',
        'name',
        'avatar_url',
        'locale',
        'timezone',
        'last_seen_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Membership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /**
     * Organizations the user currently has an active membership in.
     * Soft-deleted pivots are filtered out via `wherePivotNull`.
     *
     * @return BelongsToMany<Organization, $this>
     */
    public function organizations(): BelongsToMany
    {
        return $this
            ->belongsToMany(Organization::class, 'memberships')
            ->withPivot(['role', 'joined_at', 'deleted_at'])
            ->wherePivotNull('deleted_at')
            ->withTimestamps();
    }

    /**
     * True iff the user has an active (non-soft-deleted) membership in
     * the given organization. Cheap exists() query — no row hydration.
     */
    public function belongsToOrganization(string $orgId): bool
    {
        return $this->memberships()
            ->where('organization_id', $orgId)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * The user's role in `$orgId`, or null if they have no active
     * membership there. Uses the cast on Membership::$role.
     */
    public function roleIn(string $orgId): ?MembershipRole
    {
        $membership = $this->memberships()
            ->where('organization_id', $orgId)
            ->whereNull('deleted_at')
            ->first();

        return $membership?->role;
    }
}
