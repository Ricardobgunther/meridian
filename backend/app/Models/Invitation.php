<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use Database\Factories\InvitationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Pending / consumed email invitation into an {@see Organization} — ADR-013.
 *
 * Deliberately NOT using the {@see \App\Models\Concerns\BelongsToOrganization}
 * trait: the trait registers a global scope that throws when no current
 * organization is bound, which is exactly the situation the public
 * accept-by-token endpoints operate in (the invitee has no org context
 * yet). Admin-side queries scope manually via the route binding's
 * `{organization}` parameter — same pattern {@see Membership} already
 * follows.
 *
 * Properties of the row:
 *
 * @property string $id
 * @property string $organization_id
 * @property string $email                    Always lowercased+trimmed at the service layer
 * @property MembershipRole $role             Constrained to Member|Admin by the FormRequest + service
 * @property string $token_hash               SHA-256 hex of the raw token (always 64 chars)
 * @property InvitationStatus $status
 * @property string|null $invited_by_user_id
 * @property string|null $accepted_by_user_id
 * @property \Illuminate\Support\Carbon $expires_at
 * @property \Illuminate\Support\Carbon|null $accepted_at
 * @property \Illuminate\Support\Carbon|null $revoked_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 */
class Invitation extends Model
{
    /** @use HasFactory<InvitationFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'email',
        'role',
        'token_hash',
        'status',
        'expires_at',
        'invited_by_user_id',
        'accepted_by_user_id',
        'accepted_at',
        'revoked_at',
    ];

    /**
     * `token_hash` is omitted from the default serialization as a defence
     * in depth — even though the API uses explicit Resources, anybody
     * calling `->toArray()` (e.g. a future internal admin command) will
     * not accidentally leak the SHA digest into a log or response. The
     * raw token itself is never persisted, only this hash.
     *
     * @var list<string>
     */
    protected $hidden = [
        'token_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => MembershipRole::class,
            'status' => InvitationStatus::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Organization, $this>
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * The admin who issued the invitation. Nullable: SET NULL on user
     * delete preserves the audit trail when the inviter is removed.
     *
     * @return BelongsTo<User, $this>
     */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_user_id');
    }

    /**
     * The user who consumed the invitation. Null while pending.
     *
     * @return BelongsTo<User, $this>
     */
    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_user_id');
    }

    /**
     * True iff `status == pending` AND `expires_at > now()`. Centralised
     * here so controllers/services do not repeat the date-math check.
     *
     * Note: this does NOT mutate state. The "promote pending→expired
     * when expires_at < now()" transition lives in the service so it
     * runs inside a transaction with the rest of the accept flow.
     */
    public function isAcceptable(): bool
    {
        if ($this->status !== InvitationStatus::Pending) {
            return false;
        }

        return $this->expires_at->isFuture();
    }
}
