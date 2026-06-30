<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\MembershipRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the query string for
 * `GET /api/v1/organizations/{organization}/members`.
 *
 * The listing endpoint is itself authorised by the policy in the
 * controller (`viewAny` on {@see \App\Models\Membership}), but the query
 * parameters used to narrow the list still need their own validation
 * pass — otherwise unbounded `per_page`, free-form `role` values or
 * oversize `q` strings would reach the database layer.
 *
 * No model-shaping logic lives here on purpose; the controller composes
 * the query from `validated()`, keeping the request a pure DTO.
 */
class ListMembershipsRequest extends FormRequest
{
    /**
     * The `org.resolve` middleware has already enforced that the caller
     * holds an active membership in `{organization}`. Listing is open to
     * every member of the org, so we defer the policy check to the
     * controller's `authorize('viewAny', …)` call and accept here.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', Rule::in([
                MembershipRole::Owner->value,
                MembershipRole::Admin->value,
                MembershipRole::Member->value,
            ])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.string' => 'O termo de busca deve ser um texto.',
            'q.max' => 'O termo de busca deve ter no máximo 100 caracteres.',
            'role.in' => 'A função deve ser "owner", "admin" ou "member".',
            'per_page.integer' => 'O parâmetro per_page deve ser um número inteiro.',
            'per_page.min' => 'O parâmetro per_page deve ser pelo menos 1.',
            'per_page.max' => 'O parâmetro per_page não pode ser maior que 100.',
            'page.integer' => 'O parâmetro page deve ser um número inteiro.',
            'page.min' => 'O parâmetro page deve ser pelo menos 1.',
        ];
    }
}
