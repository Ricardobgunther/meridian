<?php

declare(strict_types=1);

use App\Enums\MembershipRole;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Support\Facades\Mail;

/*
|--------------------------------------------------------------------------
| InvitationMail — content, subject, recipient, accept URL
|--------------------------------------------------------------------------
|
| We render the Mailable explicitly (no Mail::fake here) to inspect the
| compiled HTML. For the dispatch-side assertions we wrap the service in
| Mail::fake() so we can pin recipient + class without touching SMTP.
|
*/

it('targets the invitee email and uses the PT-BR subject with org name', function (): void {
    Mail::fake();

    config(['app.frontend_url' => 'https://app.test']);

    $org = Organization::factory()->create(['name' => 'Acme Foundation']);
    $inviter = User::factory()->create(['name' => 'Alice Admin']);

    /** @var InvitationService $service */
    $service = app(InvitationService::class);
    $result = $service->invite($org, $inviter, 'invitee@example.com', MembershipRole::Admin);

    Mail::assertSent(InvitationMail::class, function (InvitationMail $mail) use ($result): bool {
        expect($mail->hasTo('invitee@example.com'))->toBeTrue();
        expect($mail->envelope()->subject)->toBe('Você foi convidado para entrar em Acme Foundation');
        // The Mailable holds the RAW token (not the hash) so the rendered
        // accept link uses the right value.
        expect($mail->rawToken)->toBe($result['token']);

        return true;
    });
});

it('renders an accept URL pointing at the configured frontend_url with the RAW token', function (): void {
    config(['app.frontend_url' => 'https://app.test']);

    $org = Organization::factory()->create(['name' => 'Acme Foundation']);
    $inviter = User::factory()->create(['name' => 'Alice Admin']);
    $invitation = Invitation::factory()->create([
        'organization_id' => $org->id,
        'email' => 'invitee@example.com',
        'invited_by_user_id' => $inviter->id,
        'role' => MembershipRole::Admin->value,
    ]);
    $invitation->setRelation('organization', $org);
    $invitation->setRelation('invitedBy', $inviter);

    $rawToken = 'unit-test-raw-token-1234567890ABC';
    $mail = (new InvitationMail($invitation, $rawToken))->render();

    expect($mail)->toContain('https://app.test/invite/'.$rawToken);
    // Make sure the SHA-256 digest is NOT in the rendered body.
    expect($mail)->not->toContain($invitation->getAttribute('token_hash'));
});

it('localises the role label and organization name into the body', function (): void {
    config(['app.frontend_url' => 'https://app.test']);

    $org = Organization::factory()->create(['name' => 'Beta Co.']);
    $inviter = User::factory()->create(['name' => 'Bob Boss']);
    $invitation = Invitation::factory()->create([
        'organization_id' => $org->id,
        'invited_by_user_id' => $inviter->id,
        'role' => MembershipRole::Member->value,
    ]);
    $invitation->setRelation('organization', $org);
    $invitation->setRelation('invitedBy', $inviter);

    $body = (new InvitationMail($invitation, 'raw-token-here-1234567890ABCDEFGH'))->render();

    expect($body)->toContain('Beta Co.');
    expect($body)->toContain('Bob Boss');
    expect($body)->toContain('Membro');
});

it('falls back to "Um administrador" when the inviter is null (e.g. deleted user)', function (): void {
    config(['app.frontend_url' => 'https://app.test']);

    $org = Organization::factory()->create(['name' => 'Solo Inc.']);
    $invitation = Invitation::factory()->create([
        'organization_id' => $org->id,
        'invited_by_user_id' => null,
    ]);
    $invitation->setRelation('organization', $org);
    $invitation->setRelation('invitedBy', null);

    $body = (new InvitationMail($invitation, 'fallback-token-1234567890ABCDEFGHI'))->render();

    expect($body)->toContain('Um administrador');
});
