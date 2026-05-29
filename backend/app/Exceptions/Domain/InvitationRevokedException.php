<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised at accept-time when the invitation was revoked by an admin
 * after the email left the user's inbox. Same 410 reasoning as
 * {@see InvitationExpiredException} — the resource existed but is no
 * longer available.
 */
final class InvitationRevokedException extends InvitationException
{
    public function message(): string
    {
        return 'Este convite foi revogado pelo administrador da organização.';
    }

    public function code(): string
    {
        return 'invitation_revoked';
    }

    public function status(): int
    {
        return Response::HTTP_GONE;
    }
}
