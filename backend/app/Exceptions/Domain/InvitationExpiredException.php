<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised at accept-time when the token's invitation has lapsed.
 *
 * 410 Gone is the right semantic here — the resource existed but is no
 * longer available (vs 404, which would mask "token exists but expired"
 * as "never existed"). The accept page reads `body.code` and swaps to
 * the expired card; if only the status code is consulted, the same UX
 * still works because 410 is unique to this path.
 */
final class InvitationExpiredException extends InvitationException
{
    public function message(): string
    {
        return 'Este convite expirou. Peça um novo ao administrador da organização.';
    }

    public function code(): string
    {
        return 'invitation_expired';
    }

    public function status(): int
    {
        return Response::HTTP_GONE;
    }
}
