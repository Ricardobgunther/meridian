<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\MembershipRole;
use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// The "already a member" check intentionally lives in
// {@see \App\Services\MembershipService::add()}, not as a FormRequest
// `unique` rule. The service owns soft-delete restore semantics: a
// previously-removed member must be reactivated (not rejected), so a
// blanket `unique` rule here would either lie (reject restorable rows)
// or accidentally let conflicting inserts hit the DB unique index.

/**
 * Validates the payload for `POST /api/v1/organizations/{organization}/members`.
 *
 * This endpoint is the direct "add an existing user by id" path; the
 * invite-by-email flow lives in a separate request (future work).
 * The `owner` role cannot be assigned via this endpoint — owners are
 * created exclusively by {@see \App\Services\OrganizationService::createWithOwner()}.
 */
class StoreMembershipRequest extends FormRequest
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
        return [
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('users', 'id')->whereNull('deleted_at'),
            ],
            'role' => ['nullable', Rule::in([MembershipRole::Admin->value, MembershipRole::Member->value])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Informe o usuário a ser adicionado.',
            'user_id.uuid' => 'ID de usuário inválido.',
            'user_id.exists' => 'Usuário não encontrado.',
            'role.in' => 'A função deve ser "admin" ou "member".',
        ];
    }
}
