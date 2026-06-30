<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Enums\MembershipRole;
use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the payload for `POST /api/v1/invitations`.
 *
 * Two non-obvious choices:
 *  - `role` is restricted to `member|admin` here — `owner` is rejected
 *    BEFORE the service runs so a manipulated payload cannot even reach
 *    the rate-limit check. ADR-013 forbids inviting as owner, and the
 *    DB CHECK constraint enforces it again at insert-time on Postgres.
 *  - `email:rfc` (not `email:rfc,dns`) so unit/feature tests on SQLite
 *    don't depend on network DNS resolution. The DNS check is an
 *    extra layer that fits a future production-only validator.
 */
class StoreInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $organization = $this->attributes->get('current_organization');

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
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'role' => [
                'required',
                Rule::in([
                    MembershipRole::Member->value,
                    MembershipRole::Admin->value,
                ]),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Informe um email.',
            'email.email' => 'Email inválido.',
            'email.max' => 'O email é muito longo.',
            'role.required' => 'Selecione uma função.',
            'role.in' => 'Escolha entre "member" ou "admin".',
        ];
    }
}
