<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised by accept/decline POST paths when the token does not match any
 * row (either the user mistyped, the row was hard-deleted, or — more
 * likely — they pasted only part of the URL).
 *
 * The public PREVIEW endpoint (GET) does NOT raise this; it returns 200
 * with `status: 'not_found'` to keep the token-enumeration surface flat
 * across "expired", "revoked" and "doesn't exist".
 */
final class InvitationNotFoundException extends InvitationException
{
    public function message(): string
    {
        return 'Convite não encontrado.';
    }

    public function code(): string
    {
        return 'invitation_not_found';
    }

    public function status(): int
    {
        return Response::HTTP_NOT_FOUND;
    }
}
