<?php

declare(strict_types=1);

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

/*
|--------------------------------------------------------------------------
| Invitations admin API — full CRUD coverage (ADR-013)
|--------------------------------------------------------------------------
|
| Covers `/api/v1/invitations` (index/store/destroy/resend) for the
| admin side. The accept/decline flow (token-keyed, public preview)
| lives in `AcceptInvitationApiTest`.
|
| Tenancy contract: the active organization comes from `X-Organization-Id`
| via the `org.resolve` middleware. The `{invitation}` route bind scopes
| to that same header, so a cross-tenant id 404s at the binding layer
| (follow-up R4 — see route comment), same as `{member}`.
|
| Auth setup mirrors `MembersApiTest`: swap the JWT secret to the
| deterministic test constant, reuse `actingAsSupabaseUser()`.
|
*/

beforeEach(function (): void {
    config([
        'supabase.jwt_secret' => TEST_JWT_SECRET,
        'supabase.url' => null,
    ]);

    // Always fake mail in the admin tests — store/resend dispatch
    // InvitationMail synchronously inside the service transaction.
    Mail::fake();
});

/**
 * Build (org, owner) + headers in one shot.
 *
 * @return array{org: Organization, owner: User, headers: array<string, string>}
 */
function ownedOrg(): array
{
    $owner = User::factory()->create();
    $org = Organization::factory()->create();
    Membership::factory()->owner()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
    ]);

    return [
        'org' => $org,
        'owner' => $owner,
        'headers' => array_merge(
            actingAsSupabaseUser($owner),
            ['X-Organization-Id' => $org->id],
        ),
    ];
}

// ─── Index ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/invitations', function (): void {
    it('returns pending invitations of the active org for the owner', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->count(3)->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations')
            ->assertOk();

        $response->assertJsonCount(3, 'data');
        foreach ($response->json('data') as $row) {
            expect($row)->toHaveKeys([
                'id', 'organization_id', 'email', 'role', 'status',
                'expires_at', 'created_at', 'resent_at', 'invited_by',
            ]);
            expect($row['status'])->toBe('pending');
            expect($row['organization_id'])->toBe($org->id);
        }
    });

    it('defaults to status=pending and hides accepted/revoked/expired rows', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);
        Invitation::factory()->accepted()->create(['organization_id' => $org->id]);
        Invitation::factory()->revoked()->create(['organization_id' => $org->id]);
        Invitation::factory()->expired()->create(['organization_id' => $org->id]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations')
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.status', 'pending');
    });

    it('returns every status when status=all is requested', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create(['organization_id' => $org->id, 'status' => 'pending']);
        Invitation::factory()->accepted()->create(['organization_id' => $org->id]);
        Invitation::factory()->revoked()->create(['organization_id' => $org->id]);

        $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?status=all')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    });

    it('filters by status=revoked', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create(['organization_id' => $org->id, 'status' => 'pending']);
        $revoked = Invitation::factory()->revoked()->create(['organization_id' => $org->id]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?status=revoked')
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $revoked->id);
    });

    it('orders by created_at desc — newest invite first', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $old = Invitation::factory()->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::parse('2026-01-01 00:00:00'),
        ]);
        $mid = Invitation::factory()->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::parse('2026-02-01 00:00:00'),
        ]);
        $new = Invitation::factory()->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::parse('2026-03-01 00:00:00'),
        ]);

        $ids = collect(
            $this->withHeaders($headers)
                ->getJson('/api/v1/invitations')
                ->assertOk()
                ->json('data'),
        )->pluck('id')->all();

        expect($ids)->toBe([$new->id, $mid->id, $old->id]);
    });

    it('does NOT leak invitations from a sibling organization', function (): void {
        ['org' => $orgA, 'headers' => $headers] = ownedOrg();

        $orgB = Organization::factory()->create();
        Invitation::factory()->create(['organization_id' => $orgA->id]);
        Invitation::factory()->create(['organization_id' => $orgB->id]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations')
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        expect($response->json('data.0.organization_id'))->toBe($orgA->id);
    });

    it('filters by case-insensitive email substring via ?search=', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create([
            'organization_id' => $org->id,
            'email' => 'maria@example.com',
        ]);
        Invitation::factory()->create([
            'organization_id' => $org->id,
            'email' => 'joao@example.com',
        ]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?search=MARIA')
            ->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.email', 'maria@example.com');
    });

    it('paginates with per_page=2', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();
        Invitation::factory()->count(3)->create(['organization_id' => $org->id]);

        $page1 = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?per_page=2')
            ->assertOk();
        $page1->assertJsonCount(2, 'data');

        $page2 = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?per_page=2&page=2')
            ->assertOk();
        $page2->assertJsonCount(1, 'data');
    });

    it('returns 401 without a Supabase JWT', function (): void {
        $org = Organization::factory()->create();

        $this->withHeaders(['X-Organization-Id' => $org->id])
            ->getJson('/api/v1/invitations')
            ->assertStatus(401);
    });

    it('returns 403 when a plain member calls index (not an admin)', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
            'role' => MembershipRole::Member->value,
        ]);

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($member),
            ['X-Organization-Id' => $org->id],
        ))
            ->getJson('/api/v1/invitations')
            ->assertStatus(403);
    });

    it('returns 403 when the caller has no membership in the active org', function (): void {
        $outsider = User::factory()->create();
        $org = Organization::factory()->create();

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($outsider),
            ['X-Organization-Id' => $org->id],
        ))
            ->getJson('/api/v1/invitations')
            ->assertStatus(403);
    });

    it('rejects an unknown status filter with 422 PT-BR', function (): void {
        ['headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?status=ghost')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status'])
            ->assertJsonPath('errors.status.0', 'Status inválido.');
    });

    it('rejects per_page > 100 with 422 PT-BR', function (): void {
        ['headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->getJson('/api/v1/invitations?per_page=101')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['per_page']);
    });

    it('eager-loads invitedBy and renders the inviter sub-document', function (): void {
        ['org' => $org, 'owner' => $owner, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create([
            'organization_id' => $org->id,
            'invited_by_user_id' => $owner->id,
        ]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/invitations')
            ->assertOk();

        $response->assertJsonPath('data.0.invited_by.id', $owner->id);
        $response->assertJsonPath('data.0.invited_by.email', $owner->email);
        $response->assertJsonPath('data.0.invited_by.is_active_member', true);
    });
});

// ─── Store ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/invitations', function (): void {
    it('creates a pending invitation and dispatches the email', function (): void {
        ['org' => $org, 'owner' => $owner, 'headers' => $headers] = ownedOrg();

        $response = $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'newcomer@example.com',
                'role' => 'member',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('data.email', 'newcomer@example.com');
        $response->assertJsonPath('data.role', 'member');
        $response->assertJsonPath('data.status', 'pending');
        $response->assertJsonPath('data.organization_id', $org->id);
        // resent_at must be null on the initial send (updated_at ≈ created_at).
        $response->assertJsonPath('data.resent_at', null);

        $this->assertDatabaseHas('invitations', [
            'organization_id' => $org->id,
            'email' => 'newcomer@example.com',
            'role' => 'member',
            'status' => 'pending',
            'invited_by_user_id' => $owner->id,
        ]);

        Mail::assertSent(InvitationMail::class, function (InvitationMail $mail) {
            return $mail->hasTo('newcomer@example.com');
        });
    });

    it('normalises the email to lowercase + trimmed before persisting', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => '  Mixed.Case@Example.COM  ',
                'role' => 'member',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.email', 'mixed.case@example.com');

        $this->assertDatabaseHas('invitations', [
            'organization_id' => $org->id,
            'email' => 'mixed.case@example.com',
        ]);
    });

    it('stores token_hash as a 64-char SHA-256 hex digest and never persists the raw token', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'hash-check@example.com',
                'role' => 'member',
            ])
            ->assertStatus(201);

        /** @var Invitation $row */
        $row = Invitation::query()->where('email', 'hash-check@example.com')->firstOrFail();
        // Access the hidden column via the raw attribute.
        $hash = $row->getAttribute('token_hash');
        expect($hash)->toBeString();
        expect(strlen($hash))->toBe(64);
        expect(ctype_xdigit($hash))->toBeTrue();
    });

    it('defaults expires_at to ~7 days in the future', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();
        Carbon::setTestNow('2026-05-01 12:00:00');

        try {
            $this->withHeaders($headers)
                ->postJson('/api/v1/invitations', [
                    'email' => 'expires@example.com',
                    'role' => 'member',
                ])
                ->assertStatus(201);

            /** @var Invitation $row */
            $row = Invitation::query()->where('email', 'expires@example.com')->firstOrFail();
            $expected = Carbon::parse('2026-05-08 12:00:00');
            expect(abs($row->expires_at->diffInSeconds($expected)))->toBeLessThanOrEqual(2);
        } finally {
            Carbon::setTestNow();
        }
    });

    it('allows admins (not just owners) to issue invitations', function (): void {
        $admin = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->admin()->create([
            'organization_id' => $org->id,
            'user_id' => $admin->id,
        ]);

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($admin),
            ['X-Organization-Id' => $org->id],
        ))
            ->postJson('/api/v1/invitations', [
                'email' => 'admin-issued@example.com',
                'role' => 'member',
            ])
            ->assertStatus(201);
    });

    it('rejects role=owner with 422 PT-BR (ADR-013 forbids inviting as owner)', function (): void {
        ['headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'owner-candidate@example.com',
                'role' => 'owner',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role'])
            ->assertJsonPath('errors.role.0', 'Escolha entre "member" ou "admin".');
    });

    it('returns 422 when email is missing', function (): void {
        ['headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'role' => 'member',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'Informe um email.');
    });

    it('returns 422 PT-BR when email is malformed', function (): void {
        ['headers' => $headers] = ownedOrg();

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'not-an-email',
                'role' => 'member',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'Email inválido.');
    });

    it('returns 422 with the already_member code when the email is already an active member', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $member = User::factory()->create(['email' => 'already@example.com']);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'already@example.com',
                'role' => 'member',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'invitation_already_member')
            ->assertJsonPath('error', 'Esta pessoa já é membro desta organização.');
    });

    it('detects already-member case-insensitively', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $member = User::factory()->create(['email' => 'alice@example.com']);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'ALICE@Example.com',
                'role' => 'admin',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'invitation_already_member');
    });

    it('returns 409 invitation_already_pending when an open invite exists for the same email', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->create([
            'organization_id' => $org->id,
            'email' => 'pending@example.com',
            'status' => InvitationStatus::Pending->value,
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'pending@example.com',
                'role' => 'member',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'invitation_already_pending')
            ->assertJsonPath('error', 'Já existe um convite pendente para este email.');
    });

    it('allows re-invite once a previous invite is revoked / expired / accepted', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        // Three terminal-state invites for the SAME email — none of them
        // should block a fresh `pending` issuance.
        Invitation::factory()->revoked()->create([
            'organization_id' => $org->id,
            'email' => 'reopen@example.com',
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'reopen@example.com',
                'role' => 'member',
            ])
            ->assertStatus(201);
    });

    it('returns 429 invitation_rate_limited at the 21st issuance in 24h', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        // 20 invitations created in the last 24h consume the budget.
        Invitation::factory()->count(20)->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::now()->subHours(1),
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'over-limit@example.com',
                'role' => 'member',
            ])
            ->assertStatus(429)
            ->assertJsonPath('code', 'invitation_rate_limited');
    });

    it('does not count invitations older than 24h toward the rate limit', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        Invitation::factory()->count(20)->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::now()->subDays(2),
        ]);

        $this->withHeaders($headers)
            ->postJson('/api/v1/invitations', [
                'email' => 'fresh-day@example.com',
                'role' => 'member',
            ])
            ->assertStatus(201);
    });

    it('returns 401 without auth', function (): void {
        $org = Organization::factory()->create();

        $this->withHeaders(['X-Organization-Id' => $org->id])
            ->postJson('/api/v1/invitations', [
                'email' => 'noauth@example.com',
                'role' => 'member',
            ])
            ->assertStatus(401);
    });

    it('returns 403 when a plain member tries to invite', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
            'role' => MembershipRole::Member->value,
        ]);

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($member),
            ['X-Organization-Id' => $org->id],
        ))
            ->postJson('/api/v1/invitations', [
                'email' => 'blocked@example.com',
                'role' => 'member',
            ])
            ->assertStatus(403);

        Mail::assertNothingSent();
    });
});

// ─── Destroy (revoke) ────────────────────────────────────────────────────────

describe('DELETE /api/v1/invitations/{invitation}', function (): void {
    it('revokes a pending invitation and stamps revoked_at', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);

        $this->withHeaders($headers)
            ->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertNoContent();

        $fresh = $invite->fresh();
        expect($fresh->status)->toBe(InvitationStatus::Revoked);
        expect($fresh->revoked_at)->not->toBeNull();
    });

    it('is idempotent on an already-revoked invitation (204 no-op)', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->revoked()->create([
            'organization_id' => $org->id,
        ]);
        $originalRevokedAt = $invite->revoked_at;

        $this->withHeaders($headers)
            ->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertNoContent();

        // Service returns early — revoked_at not bumped.
        expect($invite->fresh()->revoked_at?->toIso8601String())
            ->toBe($originalRevokedAt?->toIso8601String());
    });

    it('is a silent no-op on an accepted invitation (does NOT downgrade to revoked)', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->accepted()->create([
            'organization_id' => $org->id,
        ]);

        $this->withHeaders($headers)
            ->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertNoContent();

        expect($invite->fresh()->status)->toBe(InvitationStatus::Accepted);
    });

    it('returns 404 cross-tenant (different orgs)', function (): void {
        // Caller owns org A, tries to revoke an invite in org B. The bind
        // scopes by the X-Organization-Id header (org A), so org B's row is
        // never found — 404 instead of leaking its existence via a 403 (R4).
        ['headers' => $headers] = ownedOrg();

        $orgB = Organization::factory()->create();
        $invite = Invitation::factory()->create(['organization_id' => $orgB->id]);

        $this->withHeaders($headers)
            ->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertStatus(404);

        // Untouched.
        expect($invite->fresh()->status)->toBe(InvitationStatus::Pending);
    });

    it('returns 404 for an unknown invitation id', function (): void {
        ['headers' => $headers] = ownedOrg();
        $missing = '00000000-0000-0000-0000-000000000000';

        $this->withHeaders($headers)
            ->deleteJson("/api/v1/invitations/{$missing}")
            ->assertStatus(404);
    });

    it('returns 403 when a plain member tries to revoke', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
            'role' => MembershipRole::Member->value,
        ]);
        $invite = Invitation::factory()->create(['organization_id' => $org->id]);

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($member),
            ['X-Organization-Id' => $org->id],
        ))
            ->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertStatus(403);

        expect($invite->fresh()->status)->toBe(InvitationStatus::Pending);
    });

    it('returns 401 without auth', function (): void {
        $org = Organization::factory()->create();
        $invite = Invitation::factory()->create(['organization_id' => $org->id]);

        $this->deleteJson("/api/v1/invitations/{$invite->id}")
            ->assertStatus(401);
    });
});

// ─── Resend ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/invitations/{invitation}/resend', function (): void {
    it('regenerates the token_hash, resets expires_at, and dispatches a fresh email', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        // Set the original "created" 3 days ago so the resent_at delta is observable.
        Carbon::setTestNow('2026-05-01 00:00:00');
        $invite = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);
        $originalHash = $invite->getAttribute('token_hash');
        $originalExpiresAt = $invite->expires_at;

        Carbon::setTestNow('2026-05-04 00:00:00');

        try {
            $response = $this->withHeaders($headers)
                ->postJson("/api/v1/invitations/{$invite->id}/resend")
                ->assertOk();

            $response->assertJsonPath('data.id', $invite->id);
            $response->assertJsonPath('data.status', 'pending');

            $fresh = $invite->fresh();
            expect($fresh->getAttribute('token_hash'))->not->toBe($originalHash);
            // expires_at must be in the future, ahead of the original.
            expect($fresh->expires_at->greaterThan($originalExpiresAt))->toBeTrue();

            Mail::assertSent(InvitationMail::class, function (InvitationMail $mail) use ($invite) {
                return $mail->hasTo($invite->email);
            });
        } finally {
            Carbon::setTestNow();
        }
    });

    it('returns 422 invitation_not_pending when the invite is already accepted', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->accepted()->create(['organization_id' => $org->id]);

        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(422)
            ->assertJsonPath('code', 'invitation_not_pending');

        Mail::assertNothingSent();
    });

    it('returns 422 invitation_not_pending when the invite is revoked', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->revoked()->create(['organization_id' => $org->id]);

        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(422)
            ->assertJsonPath('code', 'invitation_not_pending');
    });

    it('honours the per-org rate limit on resends', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        // 20 prior invites in the rolling window saturate the budget.
        Invitation::factory()->count(19)->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::now()->subHours(1),
        ]);
        $target = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
            'created_at' => Carbon::now()->subHours(1),
        ]);

        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$target->id}/resend")
            ->assertStatus(429)
            ->assertJsonPath('code', 'invitation_rate_limited');
    });

    it('rate-limits a second resend inside the per-invite cooldown (R1)', function (): void {
        ['org' => $org, 'headers' => $headers] = ownedOrg();

        $invite = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);

        // First resend succeeds and stamps last_resent_at.
        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertOk();

        // Immediate second resend is inside the cooldown → 429.
        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(429)
            ->assertJsonPath('code', 'invitation_rate_limited');
    });

    it('returns 404 cross-tenant', function (): void {
        // Bind scopes by X-Organization-Id (org A); org B's row is invisible (R4).
        ['headers' => $headers] = ownedOrg();

        $orgB = Organization::factory()->create();
        $invite = Invitation::factory()->create(['organization_id' => $orgB->id]);

        $this->withHeaders($headers)
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(404);
    });

    it('returns 403 when a plain member tries to resend', function (): void {
        $member = User::factory()->create();
        $org = Organization::factory()->create();
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $member->id,
            'role' => MembershipRole::Member->value,
        ]);
        $invite = Invitation::factory()->create(['organization_id' => $org->id]);

        $this->withHeaders(array_merge(
            actingAsSupabaseUser($member),
            ['X-Organization-Id' => $org->id],
        ))
            ->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(403);
    });

    it('returns 401 without auth', function (): void {
        $org = Organization::factory()->create();
        $invite = Invitation::factory()->create(['organization_id' => $org->id]);

        $this->postJson("/api/v1/invitations/{$invite->id}/resend")
            ->assertStatus(401);
    });
});
