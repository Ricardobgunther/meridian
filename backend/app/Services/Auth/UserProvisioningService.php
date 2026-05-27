<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Lazy-upserts the local `users` row that mirrors a Supabase auth user
 * — ADR-011.
 *
 * Called by {@see \App\Http\Middleware\VerifySupabaseToken} on every
 * authenticated request. First call inserts; subsequent calls only bump
 * `last_seen_at` and refresh profile fields if Supabase changed them.
 */
class UserProvisioningService
{
    /**
     * Provision (or refresh) the local user row from validated JWT claims.
     *
     * @param  array<string, mixed>  $claims  Decoded Supabase JWT claims.
     *                                        Must contain `sub` (uuid)
     *                                        and `email`.
     *
     * @throws InvalidArgumentException When required claims are missing.
     */
    public function provisionFromClaims(array $claims): User
    {
        $sub = $claims['sub'] ?? null;
        $email = $claims['email'] ?? null;

        if (! is_string($sub) || $sub === '') {
            throw new InvalidArgumentException('Claim "sub" ausente ou inválida.');
        }

        if (! is_string($email) || $email === '') {
            throw new InvalidArgumentException('Claim "email" ausente ou inválida.');
        }

        $metadata = $this->arrayClaim($claims, 'user_metadata');

        $name = $this->stringOrNull($metadata['full_name'] ?? $metadata['name'] ?? null);
        $avatarUrl = $this->stringOrNull($metadata['avatar_url'] ?? null);

        return DB::transaction(function () use ($sub, $email, $name, $avatarUrl): User {
            $existing = User::withTrashed()->find($sub);

            $now = Carbon::now();

            $attributes = [
                'email' => $email,
                'name' => $name,
                'avatar_url' => $avatarUrl,
                'last_seen_at' => $now,
            ];

            if ($existing === null) {
                $user = User::create([
                    'id' => $sub,
                    ...$attributes,
                ]);

                Log::info('user.provisioned', ['user_id' => $sub]);

                return $user;
            }

            // If the row was soft-deleted, undelete it on the next sign-in.
            // Supabase has clearly re-authenticated this identity.
            if ($existing->trashed()) {
                $existing->restore();
                Log::info('user.restored', ['user_id' => $sub]);
            }

            $existing->fill($attributes)->save();

            return $existing;
        });
    }

    /**
     * @param  array<string, mixed>  $claims
     * @return array<string, mixed>
     */
    private function arrayClaim(array $claims, string $key): array
    {
        $value = $claims[$key] ?? [];

        return is_array($value) ? $value : [];
    }

    private function stringOrNull(mixed $value): ?string
    {
        if (is_string($value) && $value !== '') {
            return $value;
        }

        return null;
    }
}
