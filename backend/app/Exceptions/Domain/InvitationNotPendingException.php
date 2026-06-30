<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * Raised when an admin attempts to RESEND a non-pending invitation
 * (already accepted, revoked or expired). 422 — the request is well-
 * formed but the state machine doesn't allow it.
 *
 * Note: revoke is intentionally idempotent (revoking an already-revoked
 * invitation returns 204), so it does NOT throw this. Only resend goes
 * through this path.
 */
final class InvitationNotPendingException extends InvitationException
{
    public function message(): string
    {
        return 'Este convite não está mais pendente e não pode ser reenviado.';
    }

    public function code(): string
    {
        return 'invitation_not_pending';
    }
}
