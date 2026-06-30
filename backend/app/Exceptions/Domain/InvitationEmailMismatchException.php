<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised when an authenticated user tries to accept a token whose email
 * does not match their authenticated email. The frontend swaps to the
 * "wrong-email guard" card and offers a "Sair desta conta" CTA.
 *
 * 403 reflects authorization failure on a resource that DOES exist — the
 * invite is real, the user is just the wrong person for it.
 */
final class InvitationEmailMismatchException extends InvitationException
{
    public function message(): string
    {
        return 'Este convite foi enviado para outro email.';
    }

    public function code(): string
    {
        return 'invitation_email_mismatch';
    }

    public function status(): int
    {
        return Response::HTTP_FORBIDDEN;
    }
}
