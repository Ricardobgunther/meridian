<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * Issued by {@see \App\Services\InvitationService::invite()} when the
 * target email is already an active member of the organization. 422 by
 * default — the frontend maps `code === 'invitation_already_member'` to
 * an inline error on the email input.
 */
final class InvitationAlreadyMemberException extends InvitationException
{
    public function message(): string
    {
        return 'Esta pessoa já é membro desta organização.';
    }

    public function code(): string
    {
        return 'invitation_already_member';
    }
}
