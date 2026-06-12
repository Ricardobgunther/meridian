<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Services\OrganizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the query string for `GET /api/v1/organizations/check-slug`.
 *
 * The format rules are borrowed verbatim from
 * {@see StoreOrganizationRequest::slugFormatRules()} — minus the
 * uniqueness rule, which is the very question this endpoint answers via
 * {@see OrganizationService::isSlugAvailable()}. Any
 * authenticated user may check (same gate as creating an organization);
 * the endpoint is deliberately NOT org-scoped because no tenant context
 * is needed.
 */
class CheckOrganizationSlugRequest extends FormRequest
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
            'slug' => StoreOrganizationRequest::slugFormatRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return StoreOrganizationRequest::slugMessages();
    }
}
