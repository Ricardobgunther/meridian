<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\MembershipRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Membership>
 */
class MembershipFactory extends Factory
{
    protected $model = Membership::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory(),
            'role' => MembershipRole::Member->value,
            'joined_at' => now(),
        ];
    }

    public function owner(): static
    {
        return $this->state(fn (): array => [
            'role' => MembershipRole::Owner->value,
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn (): array => [
            'role' => MembershipRole::Admin->value,
        ]);
    }
}
