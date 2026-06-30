<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Common shape for all domain failures of the invitation aggregate.
 *
 * Each concrete subclass commits to:
 *   - a PT-BR `message()` (the user-facing string),
 *   - a stable `code()` (the contract the frontend dictionary maps from
 *     — see `04-i18n-strings.md` §5),
 *   - an HTTP `status()` (chosen per spec `06-flows-and-errors.md` §1).
 *
 * `render()` is the recommended path (Laravel calls it automatically when
 * the exception bubbles out of a controller). It always emits
 * `{ "error": message, "code": code }`. Carrying both fields keeps the
 * frontend's two-tier mapping (`body.code` first, fallback to status) able
 * to distinguish, say, `INVITATION_RATE_LIMITED` from a generic 429.
 *
 * `toResponse()` is provided so call sites can `return $exception` directly
 * without a try/catch (Laravel's Responsable contract).
 */
abstract class InvitationException extends RuntimeException implements Responsable
{
    /**
     * Default PT-BR message for the failure mode.
     */
    abstract public function message(): string;

    /**
     * Stable machine-readable code — drives the frontend i18n mapping in
     * `04-i18n-strings.md` §5. Keep lower-snake-case to match the existing
     * dictionary keys (e.g. `invitation_already_member`).
     */
    abstract public function code(): string;

    /**
     * HTTP status to return. Defaults to 422 because most domain rejections
     * are "the request was well-formed but cannot be acted on" — concrete
     * subclasses override when the semantics differ (403, 409, 410, 429).
     */
    public function status(): int
    {
        return Response::HTTP_UNPROCESSABLE_ENTITY;
    }

    public function __construct(?string $message = null)
    {
        parent::__construct($message ?? $this->message());
    }

    public function render(Request $request): ?JsonResponse
    {
        if (! $request->expectsJson() && ! $request->is('api/*')) {
            return null;
        }

        return $this->toResponse($request);
    }

    public function toResponse($request): JsonResponse
    {
        return response()->json(
            [
                'error' => $this->getMessage(),
                'code' => $this->code(),
            ],
            $this->status(),
        );
    }
}
