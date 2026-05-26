<?php

declare(strict_types=1);

namespace App\Http\Resources;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes the Supabase JWT claims into the canonical `user` JSON we expose
 * to clients. The wrapping `{ "data": ... }` envelope is added by Laravel.
 *
 * @property array<string, mixed> $resource
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $claims */
        $claims = (array) $this->resource;

        /** @var array<string, mixed> $userMetadata */
        $userMetadata = $this->arrayClaim($claims, 'user_metadata');

        /** @var array<string, mixed> $appMetadata */
        $appMetadata = $this->arrayClaim($claims, 'app_metadata');

        return [
            'id' => $this->stringOrNull($claims['sub'] ?? null),
            'email' => $this->stringOrNull($claims['email'] ?? null),
            'name' => $this->stringOrNull(
                $userMetadata['full_name'] ?? $userMetadata['name'] ?? null
            ),
            'avatar_url' => $this->stringOrNull($userMetadata['avatar_url'] ?? null),
            'provider' => $this->stringOrNull($appMetadata['provider'] ?? null),
            'providers' => $this->arrayOfStringsOrEmpty($appMetadata['providers'] ?? null),
            'created_at' => $this->iatToIso8601($claims['iat'] ?? null),
        ];
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

    /**
     * @return array<int, string>
     */
    private function arrayOfStringsOrEmpty(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(
            array_map(static fn ($item): ?string => is_string($item) ? $item : null, $value),
            static fn (?string $item): bool => $item !== null && $item !== '',
        ));
    }

    private function iatToIso8601(mixed $iat): ?string
    {
        if (! is_int($iat) && ! (is_string($iat) && ctype_digit($iat))) {
            return null;
        }

        $timestamp = (int) $iat;

        return (new DateTimeImmutable('@'.$timestamp))
            ->setTimezone(new DateTimeZone('UTC'))
            ->format(DateTimeImmutable::ATOM);
    }
}
