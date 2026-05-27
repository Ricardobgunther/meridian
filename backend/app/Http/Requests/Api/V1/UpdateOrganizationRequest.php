<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for `PATCH /api/v1/organizations/{organization}`.
 *
 * Authorization mirrors the `update` ability on
 * {@see \App\Policies\OrganizationPolicy} so unauthorized callers see a
 * 403 rather than leaking validation messages.
 */
class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $organization = $this->route('organization');

        if (! $organization instanceof Organization) {
            return false;
        }

        return $this->user()?->roleIn($organization->id)?->canManageMembers() === true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');
        $currentId = $organization instanceof Organization ? $organization->id : null;

        return [
            'name' => ['sometimes', 'string', 'min:1', 'max:120'],
            'slug' => [
                'sometimes',
                'string',
                'min:1',
                'max:60',
                'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug')
                    ->ignore($currentId)
                    ->whereNull('deleted_at'),
            ],
            'settings' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.max' => 'O nome não pode ter mais de 120 caracteres.',
            'slug.max' => 'O identificador não pode ter mais de 60 caracteres.',
            'slug.regex' => 'O identificador deve conter apenas letras minúsculas, números e hífens.',
            'slug.unique' => 'Este identificador já está em uso.',
            'settings.array' => 'As configurações devem ser um objeto.',
        ];
    }
}
