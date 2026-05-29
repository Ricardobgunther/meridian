<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised when the per-organization rate limit on invitation issuance is
 * exceeded (20 per rolling 24h — see {@see \App\Services\InvitationService}).
 *
 * The frontend modal shows a toast titled "Limite de convites atingido"
 * and keeps the form open. We deliberately do NOT include a Retry-After
 * header in this 429 because the limit is rolling and computing the
 * exact "next slot" requires an extra query the rate-limit hot path
 * doesn't justify; the message tells the user to try again later.
 */
final class InvitationRateLimitException extends InvitationException
{
    public function message(): string
    {
        return 'Você atingiu o limite de convites por agora. Tente novamente em alguns instantes.';
    }

    public function code(): string
    {
        return 'invitation_rate_limited';
    }

    public function status(): int
    {
        return Response::HTTP_TOO_MANY_REQUESTS;
    }
}
