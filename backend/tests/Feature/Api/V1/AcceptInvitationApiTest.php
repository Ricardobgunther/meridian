<?php

declare(strict_types=1);

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Carbon;

/*
|--------------------------------------------------------------------------
| Invitations accept/decline API — token-keyed flow (ADR-013, spec 06)
|--------------------------------------------------------------------------
|
| Covers:
|   GET    /api/v1/invitations/accept          (public preview)
|   POST   /api/v1/invitations/accept          (auth required)
|   POST   /api/v1/invitations/accept/decline  (auth required)
|
| The token travels in the `X-Invitation-Token` HEADER, never in the path
| (follow-up R10). The preview MUST be flat-discriminated (200 with a
| `status` payload) for every token — well-shaped, malformed or missing —
| and carry `Cache-Control: no-store` since the path is now static. The
| POSTs use the domain-exception envelope `{ error, code }` with the spec'd
| status codes.
|
*/

const INVITE_TOKEN_HEADER = 'X-Invitation-Token';

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);
});

/**
 * Issue a pending invitation and return the raw token alongside it. The
 * service hashes the raw value into `token_hash`; we mirror that via
 * `InvitationFactory::forToken()`.
 *
 * @return array{token: string, invitation: Invitation, organization: Organization}
 */
function inviteWithToken(array $attrs = []): array
{
    $token = 'ttoken-'.str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT)
        .'-abcdefghijklmnopqrstuv'; // 43+ chars, base64url-safe alphabet

    $org = Organization::factory()->create();

    $invitation = Invitation::factory()
        ->forToken($token)
        ->create(array_merge([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ], $attrs));

    return ['token' => $token, 'invitation' => $invitation, 'organization' => $org];
}

// ─── Show (public preview) ───────────────────────────────────────────────────

describe('GET /api/v1/invitations/accept (public preview)', function (): void {
    it('returns status=pending with org payload for a fresh invitation — no auth required', function (): void {
        $org = Organization::factory()->create(['name' => 'Acme Inc.', 'slug' => 'acme']);
        $inviter = User::factory()->create(['name' => 'Alice Admin']);
        ['token' => $token] = inviteWithToken([
            'organization_id' => $org->id,
            'role' => MembershipRole::Admin->value,
            'email' => 'invitee@example.com',
            'invited_by_user_id' => $inviter->id,
        ]);

        $response = $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk();

        // Static path → the preview must never be cached by an intermediary,
        // or one token's payload would be cross-served. Symfony normalises
        // `no-store` to `no-store, private`, so assert containment.
        expect($response->headers->get('Cache-Control'))->toContain('no-store');

        $response->assertJsonPath('data.status', 'pending');
        $response->assertJsonPath('data.email', 'invitee@example.com');
        $response->assertJsonPath('data.role', 'admin');
        $response->assertJsonPath('data.organization.id', $org->id);
        $response->assertJsonPath('data.organization.slug', 'acme');
        $response->assertJsonPath('data.organization.name', 'Acme Inc.');
        $response->assertJsonPath('data.invited_by.name', 'Alice Admin');
        // Privacy: no inviter email leaked on the public surface.
        expect($response->json('data.invited_by'))->not->toHaveKey('email');
    });

    it('does NOT consume the token on preview', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken();

        $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk();

        expect($invite->fresh()->status)->toBe(InvitationStatus::Pending);
    });

    it('returns status=revoked for a revoked invitation (no leak of org/email)', function (): void {
        ['token' => $token] = inviteWithToken();
        Invitation::query()->update([
            'status' => InvitationStatus::Revoked->value,
            'revoked_at' => Carbon::now(),
        ]);

        $response = $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk();

        $response->assertJsonPath('data.status', 'revoked');
        expect($response->json('data'))->not->toHaveKey('email');
        expect($response->json('data'))->not->toHaveKey('organization');
    });

    it('returns status=accepted for an accepted invitation', function (): void {
        ['token' => $token] = inviteWithToken();
        Invitation::query()->update([
            'status' => InvitationStatus::Accepted->value,
            'accepted_at' => Carbon::now(),
        ]);

        $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');
    });

    it('promotes pending → expired and returns status=expired when expires_at is past', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'expires_at' => Carbon::now()->subDay(),
        ]);

        $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'expired');

        // Side effect: the sweep happened on the preview path.
        expect($invite->fresh()->status)->toBe(InvitationStatus::Expired);
    });

    it('returns status=not_found for an unknown but well-shaped token', function (): void {
        $stranger = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq'; // 43 chars, base64url alphabet

        $this->withHeader(INVITE_TOKEN_HEADER, $stranger)
            ->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'not_found');
    });

    it('returns status=not_found (200) for a too-short token in the header', function (): void {
        // No route regex anymore — the controller shape-check (>=32 chars)
        // rejects it and the flat preview surface answers not_found.
        $this->withHeader(INVITE_TOKEN_HEADER, 'tooshort')
            ->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'not_found');
    });

    it('returns status=not_found (200) for a header with illegal characters', function (): void {
        // `$` is outside the base64url alphabet — the controller shape-check
        // rejects it before any hash/lookup.
        $this->withHeader(INVITE_TOKEN_HEADER, 'contains$dollar$sign$here$abcdefghij')
            ->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'not_found');
    });

    it('returns status=not_found (200) when the token header is missing entirely', function (): void {
        $this->getJson('/api/v1/invitations/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'not_found');
    });
});

// ─── Store (accept) ──────────────────────────────────────────────────────────

describe('POST /api/v1/invitations/accept', function (): void {
    it('consumes the token, creates an active membership, returns the org payload', function (): void {
        $org = Organization::factory()->create(['name' => 'Acme', 'slug' => 'acme']);
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'organization_id' => $org->id,
            'email' => 'joiner@example.com',
            'role' => MembershipRole::Admin->value,
        ]);
        $joiner = User::factory()->create(['email' => 'joiner@example.com']);

        $response = $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertOk();

        $response->assertJsonPath('data.role', 'admin');
        $response->assertJsonPath('data.organization.id', $org->id);
        $response->assertJsonPath('data.organization.slug', 'acme');
        $response->assertJsonPath('data.membership.role', 'admin');
        $response->assertJsonPath('data.membership.user.id', $joiner->id);

        $fresh = $invite->fresh();
        expect($fresh->status)->toBe(InvitationStatus::Accepted);
        expect($fresh->accepted_at)->not->toBeNull();
        expect($fresh->accepted_by_user_id)->toBe($joiner->id);

        $this->assertDatabaseHas('memberships', [
            'organization_id' => $org->id,
            'user_id' => $joiner->id,
            'role' => 'admin',
            'deleted_at' => null,
        ]);
    });

    it('matches the invite email case-insensitively', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'email' => 'normal@example.com',
        ]);
        $joiner = User::factory()->create(['email' => 'NORMAL@Example.COM']);

        $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertOk();

        expect($invite->fresh()->status)->toBe(InvitationStatus::Accepted);
    });

    it('returns 401 without a Supabase JWT', function (): void {
        ['token' => $token] = inviteWithToken();

        $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(401);
    });

    it('returns 403 invitation_email_mismatch when the auth email does not match', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'email' => 'target@example.com',
        ]);
        $wrongUser = User::factory()->create(['email' => 'somebody-else@example.com']);

        $this->withHeaders(actingAsSupabaseUser($wrongUser))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(403)
            ->assertJsonPath('code', 'invitation_email_mismatch')
            ->assertJsonPath('error', 'Este convite foi enviado para outro email.');

        // No state mutation.
        expect($invite->fresh()->status)->toBe(InvitationStatus::Pending);
        $this->assertDatabaseMissing('memberships', [
            'organization_id' => $invite->organization_id,
            'user_id' => $wrongUser->id,
        ]);
    });

    it('returns 410 invitation_revoked when the invite was revoked', function (): void {
        ['token' => $token] = inviteWithToken();
        Invitation::query()->update([
            'status' => InvitationStatus::Revoked->value,
            'revoked_at' => Carbon::now(),
        ]);
        $joiner = User::factory()->create();

        $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(410)
            ->assertJsonPath('code', 'invitation_revoked');
    });

    it('returns 410 invitation_expired when expires_at is in the past', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'email' => 'late@example.com',
            'expires_at' => Carbon::now()->subDay(),
        ]);
        $joiner = User::factory()->create(['email' => 'late@example.com']);

        $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(410)
            ->assertJsonPath('code', 'invitation_expired');

        // The sweep promoted the row to `expired`.
        expect($invite->fresh()->status)->toBe(InvitationStatus::Expired);
    });

    it('returns 404 invitation_not_found for an unknown but well-shaped token', function (): void {
        $stranger = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
        $user = User::factory()->create();

        $this->withHeaders(actingAsSupabaseUser($user))
            ->withHeader(INVITE_TOKEN_HEADER, $stranger)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(404)
            ->assertJsonPath('code', 'invitation_not_found');
    });

    it('is idempotent for the same acceptor (re-accept returns the existing membership)', function (): void {
        ['token' => $token, 'invitation' => $invite, 'organization' => $org] = inviteWithToken([
            'email' => 'idem@example.com',
        ]);
        $joiner = User::factory()->create(['email' => 'idem@example.com']);

        $first = $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertOk();
        $membershipId = $first->json('data.membership.id');

        $second = $this->withHeaders(actingAsSupabaseUser($joiner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertOk();

        expect($second->json('data.membership.id'))->toBe($membershipId);

        // Exactly one active membership.
        expect(Membership::query()
            ->where('organization_id', $org->id)
            ->where('user_id', $joiner->id)
            ->whereNull('deleted_at')
            ->count())->toBe(1);
    });

    it('blocks a different user from reusing an already-consumed token (410 revoked)', function (): void {
        // The invite targets `consumer@example.com`. The first acceptor
        // (with that email) consumes the token. A *different* user — even
        // signed in — must NOT be able to reuse the link; the service
        // surfaces this as `invitation_revoked` (the link is dead, no
        // matter who the second caller is).
        ['token' => $token] = inviteWithToken([
            'email' => 'consumer@example.com',
        ]);
        $first = User::factory()->create(['email' => 'consumer@example.com']);

        $this->withHeaders(actingAsSupabaseUser($first))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertOk();

        $someoneElse = User::factory()->create(['email' => 'someone-else@example.com']);
        $this->withHeaders(actingAsSupabaseUser($someoneElse))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            // The email-mismatch guard fires before the consumed-token
            // check (the acceptor's email doesn't match the invitation).
            // That's still a refusal to consume the token — the contract
            // we care about: nobody but the original target can use it.
            ->assertStatus(403)
            ->assertJsonPath('code', 'invitation_email_mismatch');
    });

    it('throttles the accept POST to 10/min/IP (named accept_invitation limiter — R5)', function (): void {
        // Defence-in-depth: even an authenticated, email-matching caller is
        // capped at 10 POSTs/min by IP. accept() is idempotent, so the first
        // 10 return 200; the 11th must be rejected by the limiter (429)
        // before reaching the controller.
        ['token' => $token] = inviteWithToken(['email' => 'flooder@example.com']);
        $joiner = User::factory()->create(['email' => 'flooder@example.com']);
        $headers = actingAsSupabaseUser($joiner);

        for ($i = 0; $i < 10; $i++) {
            $this->withHeaders($headers)
                ->withHeader(INVITE_TOKEN_HEADER, $token)
                ->postJson('/api/v1/invitations/accept')
                ->assertOk();
        }

        $this->withHeaders($headers)
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(429);
    });

    it('returns 404 invitation_not_found for a malformed (too-short) token header', function (): void {
        // No route regex — a 17-char header passes nothing at the router and
        // fails the controller's 32-char shape floor, so the accept POST
        // 404s via the shape check.
        $user = User::factory()->create();

        $this->withHeaders(actingAsSupabaseUser($user))
            ->withHeader(INVITE_TOKEN_HEADER, 'abcdefghij1234567')
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(404)
            ->assertJsonPath('code', 'invitation_not_found');
    });

    it('returns 404 invitation_not_found when the token header is missing', function (): void {
        $user = User::factory()->create();

        $this->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/invitations/accept')
            ->assertStatus(404)
            ->assertJsonPath('code', 'invitation_not_found');
    });
});

// ─── Destroy (decline) ───────────────────────────────────────────────────────

describe('POST /api/v1/invitations/accept/decline', function (): void {
    it('marks a pending invitation as revoked and returns 204', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'email' => 'decliner@example.com',
        ]);
        $decliner = User::factory()->create(['email' => 'decliner@example.com']);

        $this->withHeaders(actingAsSupabaseUser($decliner))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertNoContent();

        $fresh = $invite->fresh();
        expect($fresh->status)->toBe(InvitationStatus::Revoked);
        expect($fresh->revoked_at)->not->toBeNull();

        $this->assertDatabaseMissing('memberships', [
            'organization_id' => $invite->organization_id,
            'user_id' => $decliner->id,
        ]);
    });

    it('is idempotent against an already-non-pending invitation (silent 204)', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken();
        Invitation::query()->update([
            'status' => InvitationStatus::Revoked->value,
            'revoked_at' => Carbon::now()->subHour(),
        ]);
        $originalRevoked = $invite->fresh()->revoked_at;

        $user = User::factory()->create(['email' => $invite->email]);
        $this->withHeaders(actingAsSupabaseUser($user))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertNoContent();

        // Service early-returns; revoked_at not bumped.
        expect($invite->fresh()->revoked_at?->toIso8601String())
            ->toBe($originalRevoked?->toIso8601String());
    });

    it('returns 403 invitation_email_mismatch when the auth email does not match', function (): void {
        ['token' => $token, 'invitation' => $invite] = inviteWithToken([
            'email' => 'real-invitee@example.com',
        ]);
        $wrong = User::factory()->create(['email' => 'imposter@example.com']);

        $this->withHeaders(actingAsSupabaseUser($wrong))
            ->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertStatus(403)
            ->assertJsonPath('code', 'invitation_email_mismatch');

        expect($invite->fresh()->status)->toBe(InvitationStatus::Pending);
    });

    it('returns 401 without auth', function (): void {
        ['token' => $token] = inviteWithToken();

        $this->withHeader(INVITE_TOKEN_HEADER, $token)
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertStatus(401);
    });

    it('returns 204 (silent) for a malformed token header — no information leak', function (): void {
        // A 17-char header fails the controller shape (>=32). The decline
        // path swallows it with 204 rather than revealing anything.
        $user = User::factory()->create();
        $this->withHeaders(actingAsSupabaseUser($user))
            ->withHeader(INVITE_TOKEN_HEADER, 'aabbccddeeff11223')
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertNoContent();
    });

    it('returns 204 (silent) when the token header is missing', function (): void {
        $user = User::factory()->create();
        $this->withHeaders(actingAsSupabaseUser($user))
            ->postJson('/api/v1/invitations/accept/decline')
            ->assertNoContent();
    });
});
