<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\InvitationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the query string for `GET /api/v1/invitations`.
 *
 * Defaults applied at the controller layer: status defaults to `pending`
 * (the most common use case from the admin UI). Passing `status=all`
 * removes the status filter — useful for an audit view or future
 * "history" surface.
 */
class ListInvitationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The `org.resolve` middleware already gated the caller. Whether
        // member-level callers may list invitations is decided by the
        // policy in the controller (`viewAny`), not here — keeping this
        // request a pure query-string DTO.
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in([
                InvitationStatus::Pending->value,
                InvitationStatus::Accepted->value,
                InvitationStatus::Revoked->value,
                InvitationStatus::Expired->value,
                'all',
            ])],
            'search' => ['nullable', 'string', 'max:255'],
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
            'status.in' => 'Status inválido.',
            'search.max' => 'O termo de busca deve ter no máximo 255 caracteres.',
            'per_page.integer' => 'O parâmetro per_page deve ser um número inteiro.',
            'per_page.min' => 'O parâmetro per_page deve ser pelo menos 1.',
            'per_page.max' => 'O parâmetro per_page não pode ser maior que 100.',
            'page.integer' => 'O parâmetro page deve ser um número inteiro.',
            'page.min' => 'O parâmetro page deve ser pelo menos 1.',
        ];
    }
}
