<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Invitation>
 *
 * Default state: a fresh `pending` invitation for a `member` role,
 * expiring in 7 days. The raw token is NEVER stored — only the SHA-256
 * digest of a random 64-char string. Tests that need the raw token
 * must generate it themselves and call `forToken($raw)`, mirroring the
 * production service.
 *
 * The factory deliberately does NOT depend on `App\Services\InvitationService`
 * so it can be used in the most basic unit tests; the digest derivation
 * is one hash call and stays trivially consistent.
 */
class InvitationFactory extends Factory
{
    protected $model = Invitation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // A non-cryptographic random hex string is fine here — we are
        // not protecting anything; we just need a unique 64-char value
        // that satisfies the column's UNIQUE constraint.
        $tokenHash = hash('sha256', Str::random(40));

        return [
            'organization_id' => Organization::factory(),
            'email' => Str::lower(fake()->unique()->safeEmail()),
            'role' => MembershipRole::Member->value,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
            'invited_by_user_id' => User::factory(),
            'accepted_by_user_id' => null,
            'accepted_at' => null,
            'revoked_at' => null,
        ];
    }

    /**
     * State helper for tests that own the raw token. The factory hashes
     * the raw value and stores the digest, matching what the production
     * service does at issue time.
     */
    public function forToken(string $rawToken): static
    {
        return $this->state(fn (): array => [
            'token_hash' => hash('sha256', $rawToken),
        ]);
    }

    /**
     * Constrain the role. Owner is intentionally not exposed as a
     * helper because the API rejects owner invitations (ADR-013).
     */
    public function forRole(MembershipRole $role): static
    {
        return $this->state(fn (): array => [
            'role' => $role->value,
        ]);
    }

    public function accepted(): static
    {
        return $this->state(fn (): array => [
            'status' => 'accepted',
            'accepted_at' => now(),
            'accepted_by_user_id' => User::factory(),
        ]);
    }

    public function revoked(): static
    {
        return $this->state(fn (): array => [
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);
    }

    /**
     * Past-expiry state. We push `expires_at` into the past AND flip
     * `status` to 'expired' so the row reflects the post-sweep state.
     * Tests that want to observe the sweep job promoting a stale
     * `pending` to `expired` should set `expires_at` directly instead.
     */
    public function expired(): static
    {
        return $this->state(fn (): array => [
            'status' => 'expired',
            'expires_at' => now()->subDay(),
        ]);
    }
}
