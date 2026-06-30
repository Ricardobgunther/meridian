<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises an {@see Invitation} for the admin-facing endpoints.
 *
 * Shape mirrors the UI spec `06-flows-and-errors.md` §3 contract. Two
 * fields are intentionally omitted:
 *   - `token_hash` — never leaves the server; defence in depth even
 *     though the model's `$hidden` already strips it.
 *   - the raw token — only the email carries it. The HTTP responses of
 *     `store`/`resend` never include the token, so a compromised admin
 *     session cannot exfiltrate live invite links from the API.
 *
 * `invited_by` requires the `invitedBy` relation to be eager-loaded by
 * the caller; otherwise the field is rendered as `null` rather than
 * triggering a silent N+1 fetch.
 *
 * @property-read Invitation $resource
 */
class InvitationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Invitation $invitation */
        $invitation = $this->resource;

        return [
            'id' => $invitation->id,
            'organization_id' => $invitation->organization_id,
            'email' => $invitation->email,
            'role' => $invitation->role->value,
            'status' => $invitation->status->value,
            'expires_at' => $invitation->expires_at->toIso8601String(),
            'created_at' => $invitation->created_at?->toIso8601String(),
            'accepted_at' => $invitation->accepted_at?->toIso8601String(),
            'revoked_at' => $invitation->revoked_at?->toIso8601String(),
            // The UI spec calls this `resent_at`. We map `updated_at`
            // through it — every resend touches the row (new token_hash,
            // new expires_at) which bumps `updated_at` exactly when the
            // UI wants to surface "this was resent". When the row was
            // never resent, `updated_at` equals `created_at` and the
            // client can detect that.
            'resent_at' => $this->resolveResentAt($invitation),
            'invited_by' => $this->resolveInvitedBy($invitation),
        ];
    }

    /**
     * `resent_at` ≠ `created_at` only when the row was actually resent;
     * otherwise return null so the UI doesn't render a "reenviado em"
     * timestamp for the initial send.
     */
    private function resolveResentAt(Invitation $invitation): ?string
    {
        $created = $invitation->created_at;
        $updated = $invitation->updated_at;

        if ($created === null || $updated === null) {
            return null;
        }

        // Allow a 1-second slack to absorb same-tick INSERT/UPDATE on
        // databases whose precision is coarser than ours.
        if ($updated->diffInSeconds($created, true) <= 1) {
            return null;
        }

        return $updated->toIso8601String();
    }

    /**
     * Returns the inviter sub-document — `id`, `name`, `email` and an
     * `is_active_member` boolean so the UI can show "Não é mais membro"
     * when the inviter has left/been removed since issuing the invite.
     *
     * Rendered as `null` if the relation is not eager-loaded (defensive
     * — the controller always loads it, but a stale call site is safer
     * than an N+1 here).
     *
     * @return array<string, mixed>|null
     */
    private function resolveInvitedBy(Invitation $invitation): ?array
    {
        if (! $invitation->relationLoaded('invitedBy')) {
            return null;
        }

        $inviter = $invitation->invitedBy;

        if (! $inviter instanceof User) {
            return null;
        }

        return [
            'id' => $inviter->id,
            'name' => $inviter->name,
            'email' => $inviter->email,
            'is_active_member' => $inviter->belongsToOrganization($invitation->organization_id),
        ];
    }
}
