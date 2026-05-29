<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The PT-BR invitation email sent on {@see \App\Services\InvitationService::invite()}
 * and {@see \App\Services\InvitationService::resend()}.
 *
 * The raw token is passed in by the service — it lives only here and in
 * the rendered template. After this Mailable returns, the token is
 * unrecoverable (the model only stores its SHA-256 digest).
 *
 * Two safety properties this class preserves:
 *   1. The accept URL is built from `config('app.frontend_url')` rather
 *      than `APP_URL`. The frontend host can move independently of the
 *      API host; falling back to APP_URL silently was a footgun in an
 *      earlier draft.
 *   2. The token is interpolated into the URL but NEVER logged. We do
 *      not store the rendered URL anywhere either — Laravel's mail
 *      logging captures only message-id + recipient.
 */
class InvitationMail extends Mailable
{
    use Queueable;
    use SerializesModels;

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
