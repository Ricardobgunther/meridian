<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Membership;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serialises a {@see Membership} together with thin views of its
 * organization and (optionally) its user.
 *
 * Both `organization` and `user` are rendered only when their relation
 * has been eager-loaded by the caller. Callers MUST `->with('organization')`
 * (and `->with('user')` for the roster listing) — otherwise the field
 * is omitted from the payload rather than triggering a silent N+1.
 *
 * @property-read Membership $resource
 */
class MembershipResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Membership $membership */
        $membership = $this->resource;

        $payload = [
            'id' => $membership->id,
            'role' => $membership->role->value,
            'joined_at' => $membership->joined_at->toIso8601String(),
        ];

        if ($membership->relationLoaded('organization')) {
            $organization = $membership->organization;

            $payload['organization'] = $organization === null ? null : [
                'id' => $organization->id,
                'slug' => $organization->slug,
                'name' => $organization->name,
            ];
        }

        if ($membership->relationLoaded('user')) {
            $user = $membership->user;

            $payload['user'] = $user instanceof User ? [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
            ] : null;
        }

        return $payload;
    }
}
