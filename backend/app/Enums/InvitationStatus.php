<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Lifecycle states for an {@see \App\Models\Invitation} — ADR-013.
 *
 * Transitions allowed by the application layer:
 *   pending → accepted   (invitee called POST /accept)
 *   pending → revoked    (admin called DELETE, or invitee called decline)
 *   pending → expired    (sweep job — runs when expires_at < now())
 *
 * Adding a case here is a breaking change: also update the Postgres CHECK
 * constraint in the `2026_05_26_000004_create_invitations_table` migration
 * and the SQLite-side validation that lives on the model casts.
 */
enum InvitationStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Revoked = 'revoked';
    case Expired = 'expired';

    /**
     * PT-BR label suitable for surfacing in admin UIs / audit logs. The
     * API itself ships the raw `value` (frontend owns its own dictionary),
     * but a server-rendered admin page or a CLI command may want this.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendente',
            self::Accepted => 'Aceito',
            self::Revoked => 'Revogado',
            self::Expired => 'Expirado',
        };
    }
}
