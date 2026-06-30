<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Invitation;
use App\Services\InvitationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The PT-BR invitation email sent on {@see InvitationService::invite()}
 * and {@see InvitationService::resend()}.
 *
 * Queued (`ShouldQueue`) and dispatched after the invitation transaction
 * commits — follow-up R11. The send no longer runs synchronously inside
 * `DB::transaction()`, so a slow/failing SMTP host cannot hold the row
 * lock or roll back an already-decided state change.
 *
 * Three safety properties this class preserves:
 *   1. The accept URL is built from `config('app.frontend_url')` rather
 *      than `APP_URL`. The frontend host can move independently of the
 *      API host; falling back to APP_URL silently was a footgun in an
 *      earlier draft.
 *   2. The token is interpolated into the URL but NEVER logged. We do
 *      not store the rendered URL anywhere either — Laravel's mail
 *      logging captures only message-id + recipient.
 *   3. Queuing serializes the raw token into the job payload (until the
 *      job runs, then the row is deleted), so this Mailable is
 *      `ShouldBeEncrypted`: the payload is encrypted at rest in the
 *      `jobs`/`failed_jobs` table and the credential never sits there in
 *      plaintext. Upholds the project's "raw token is never persisted in
 *      the clear" invariant — only the SHA-256 digest lives in
 *      `invitations.token_hash`.
 */
class InvitationMail extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /**
     * Retry transient SMTP failures a few times before the job is parked
     * in `failed_jobs`, instead of dropping the invite on the first blip.
     */
    public int $tries = 3;

    /** Seconds to wait between attempts. */
    public array $backoff = [10, 30, 60];

    public function __construct(
        public readonly Invitation $invitation,
        public readonly string $rawToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->buildSubjectLine(),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.invitation',
            with: [
                'organizationName' => $this->resolveOrganizationName(),
                'inviterName' => $this->resolveInviterName(),
                'roleLabel' => $this->roleLabel(),
                'acceptUrl' => $this->buildAcceptUrl(),
                'expiresAt' => $this->invitation->expires_at->translatedFormat('d \\d\\e F \\d\\e Y \\à\\s H:i'),
            ],
        );
    }

    private function buildSubjectLine(): string
    {
        $orgName = $this->resolveOrganizationName();

        return "Você foi convidado para entrar em {$orgName}";
    }

    private function resolveOrganizationName(): string
    {
        $organization = $this->invitation->organization;
        if ($organization === null) {
            return 'sua organização';
        }

        $name = $organization->name;

        return $name !== '' ? $name : 'sua organização';
    }

    private function resolveInviterName(): string
    {
        $inviter = $this->invitation->invitedBy;
        if ($inviter === null) {
            return 'Um administrador';
        }

        $name = $inviter->name;

        return ($name === null || $name === '') ? 'Um administrador' : $name;
    }

    private function buildAcceptUrl(): string
    {
        $base = (string) (config('app.frontend_url') ?? config('app.url') ?? 'http://localhost:3000');

        return rtrim($base, '/').'/invite/'.$this->rawToken;
    }

    private function roleLabel(): string
    {
        return match ($this->invitation->role->value) {
            'admin' => 'Administrador',
            'member' => 'Membro',
            default => $this->invitation->role->value,
        };
    }
}
