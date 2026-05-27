<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for `POST /api/v1/organizations`.
 *
 * Any authenticated user can create an organization (ADR-012 — no
 * auto-created "personal org"). The slug must be globally unique,
 * URL-safe, and 1–60 characters; uniqueness ignores soft-deleted rows
 * so deleting an org frees up its slug.
 */
class StoreOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:1', 'max:120'],
            'slug' => [
                'required',
                'string',
                'min:1',
                'max:60',
                'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug')->whereNull('deleted_at'),
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
            'name.required' => 'Informe o nome da organização.',
            'name.max' => 'O nome não pode ter mais de 120 caracteres.',
            'slug.required' => 'Informe o identificador (slug) da organização.',
            'slug.max' => 'O identificador não pode ter mais de 60 caracteres.',
            'slug.regex' => 'O identificador deve conter apenas letras minúsculas, números e hífens.',
            'slug.unique' => 'Este identificador já está em uso.',
            'settings.array' => 'As configurações devem ser um objeto.',
        ];
    }
}
