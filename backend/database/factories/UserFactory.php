<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Builds local mirror rows of Supabase auth users — ADR-011.
 *
 * IDs are UUID v4 strings. In production they equal the JWT `sub`,
 * but in tests we generate fresh ones so factories work standalone.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'email' => fake()->unique()->safeEmail(),
            'name' => fake()->name(),
            'avatar_url' => null,
            'locale' => 'pt-BR',
            'timezone' => 'America/Sao_Paulo',
            'last_seen_at' => null,
        ];
    }
}
