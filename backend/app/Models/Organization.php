<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Tenant root — ADR-008.
 *
 * Every domain table eventually carries `organization_id` referencing this
 * model. `HasUuids` generates v4 UUIDs in PHP so the row works on SQLite
 * (CI) where `gen_random_uuid()` is unavailable.
 *
 * @property string $id
 * @property string $slug
 * @property string $name
 * @property array<string, mixed> $settings
 * @property string $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 */
class Organization extends Model
{
    /** @use HasFactory<\Database\Factories\OrganizationFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $fillable = [
        'slug',
        'name',
        'settings',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    /**
     * The user who founded the organization. Kept around for audit even
     * if they later leave; the migration uses `restrictOnDelete`.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<Membership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /**
     * Users who are (or were, if pivot is soft-deleted) members of this
     * organization. Callers that need only active members must filter
     * via `wherePivotNull('deleted_at')` or query `memberships()` directly.
     *
     * @return BelongsToMany<User, $this>
     */
    public function members(): BelongsToMany
    {
        return $this
            ->belongsToMany(User::class, 'memberships')
            ->withPivot(['role', 'joined_at', 'deleted_at'])
            ->withTimestamps();
    }
}
