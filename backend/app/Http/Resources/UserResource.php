<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes the local {@see User} model into the canonical `user` JSON we
 * expose to clients. The wrapping `{ "data": ... }` envelope is added
 * automatically by Laravel.
 *
 * @property-read User $resource
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
            'locale' => $user->locale,
            'timezone' => $user->timezone,
            'last_seen_at' => $user->last_seen_at?->toIso8601String(),
        ];
    }
}
