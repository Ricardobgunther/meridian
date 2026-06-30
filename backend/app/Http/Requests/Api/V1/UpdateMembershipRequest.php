<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\MembershipRole;
use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for
 * `PATCH /api/v1/organizations/{organization}/members/{member}`.
 *
 * Only role changes are accepted here. The `owner` role cannot be
 * granted via this endpoint — ownership transfers will be a separate
 * dedicated flow (future work). Additional invariants (cannot demote a
 * higher-ranked user, cannot demote the lone owner) are enforced by
 * the service layer so they apply uniformly across all call sites.
 */
class UpdateMembershipRequest extends FormRequest
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
            'role' => [
                'required',
                Rule::in([MembershipRole::Admin->value, MembershipRole::Member->value]),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'role.required' => 'Informe a nova função do membro.',
            'role.in' => 'A função deve ser "admin" ou "member".',
        ];
    }
}
