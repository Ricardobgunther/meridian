<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use Symfony\Component\HttpFoundation\Response;

/**
 * Issued by {@see \App\Services\InvitationService::invite()} when there
 * is already a `pending` invitation for the same `(organization, email)`
 * pair. The frontend surfaces this as an inline error on the email input
 * with the "Convite já enviado, use Reenviar" copy.
 */
final class InvitationAlreadyPendingException extends InvitationException
{
    public function message(): string
    {
        return 'Já existe um convite pendente para este email.';
    }

    public function code(): string
    {
        return 'invitation_already_pending';
    }

    /**
     * 409 Conflict: the email cannot be re-invited while a prior invite
     * is still open. The admin must Resend or wait for it to expire.
     */
    public function status(): int
    {
        return Response::HTTP_CONFLICT;
    }
}
