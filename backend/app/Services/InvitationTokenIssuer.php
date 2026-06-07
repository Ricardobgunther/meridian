<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\Domain\InvitationNotFoundException;
use App\Models\Invitation;

/**
 * Mints and resolves invitation tokens — extracted from
 * {@see InvitationService} (follow-up R3) to keep that service within the
 * 300-line budget and to isolate the token mechanics (crypto + lookup)
 * from the invitation use-cases.
 *
 * The raw token is generated once here, handed to the mailable, and never
 * persisted — only its SHA-256 digest lives in `token_hash`.
 */
class InvitationTokenIssuer
{
    /** 32 bytes, base64url — 43 chars no padding, URL-safe. */
    public function generate(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public function hash(string $rawToken): string
    {
        return hash('sha256', $rawToken);
    }

    public function find(string $rawToken): ?Invitation
    {
        return Invitation::query()
            ->where('token_hash', $this->hash($rawToken))
            ->whereNull('deleted_at')
            ->first();
    }

    /** @throws InvitationNotFoundException */
    public function findForUpdate(string $rawToken): Invitation
    {
        $invitation = Invitation::query()
            ->where('token_hash', $this->hash($rawToken))
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();

        if ($invitation === null) {
            throw new InvitationNotFoundException;
        }

        return $invitation;
    }
}
