<?php

declare(strict_types=1);

use App\Enums\InvitationStatus;
use App\Enums\MembershipRole;
use App\Exceptions\Domain\InvitationAlreadyMemberException;
use App\Exceptions\Domain\InvitationAlreadyPendingException;
use App\Exceptions\Domain\InvitationEmailMismatchException;
use App\Exceptions\Domain\InvitationExpiredException;
use App\Exceptions\Domain\InvitationNotFoundException;
use App\Exceptions\Domain\InvitationNotPendingException;
use App\Exceptions\Domain\InvitationRateLimitException;
use App\Exceptions\Domain\InvitationRevokedException;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

/*
|--------------------------------------------------------------------------
| InvitationService — unit tests
|--------------------------------------------------------------------------
|
| Exercises the service directly without the HTTP layer. Mirrors the
| `MembershipServiceTest` pattern: opt into TestCase + RefreshDatabase
| explicitly because `tests/Pest.php` only applies them under `Feature/`.
|
*/
uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    Mail::fake();
    $this->service = app(InvitationService::class);
});

// ─── invite() ────────────────────────────────────────────────────────────────

describe('InvitationService::invite()', function (): void {
    it('produces a 43-char base64url raw token and a 64-char SHA-256 hex digest', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();

        $result = $this->service->invite($org, $inviter, 'newcomer@example.com', MembershipRole::Member);

        $token = $result['token'];
        expect(strlen($token))->toBe(43);
        expect(preg_match('/^[A-Za-z0-9_-]{43}$/', $token))->toBe(1);

        $hash = $result['invitation']->getAttribute('token_hash');
        expect($hash)->toBe(hash('sha256', $token));
        expect(strlen($hash))->toBe(64);
    });

    it('normalises the email and stamps a 7-day expiry', function (): void {
        Carbon::setTestNow('2026-05-01 12:00:00');

        try {
            $org = Organization::factory()->create();
            $inviter = User::factory()->create();

            $result = $this->service->invite($org, $inviter, '  Mixed@Example.COM  ', MembershipRole::Admin);
            $invite = $result['invitation'];

            expect($invite->email)->toBe('mixed@example.com');
            expect($invite->role)->toBe(MembershipRole::Admin);
            expect($invite->status)->toBe(InvitationStatus::Pending);
            expect($invite->invited_by_user_id)->toBe($inviter->id);
            expect(abs($invite->expires_at->diffInSeconds(Carbon::parse('2026-05-08 12:00:00'))))
                ->toBeLessThanOrEqual(2);
        } finally {
            Carbon::setTestNow();
        }
    });

    it('throws InvitationAlreadyMemberException for an already-active member', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $existing = User::factory()->create(['email' => 'already@example.com']);
        Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $existing->id,
        ]);

        expect(fn () => $this->service->invite($org, $inviter, 'already@example.com', MembershipRole::Member))
            ->toThrow(InvitationAlreadyMemberException::class);

        $this->assertDatabaseMissing('invitations', [
            'organization_id' => $org->id,
            'email' => 'already@example.com',
        ]);
        Mail::assertNothingSent();
    });

    it('does NOT consider a soft-deleted member as still a member', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $departed = User::factory()->create(['email' => 'left@example.com']);
        $mem = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $departed->id,
        ]);
        $mem->delete();

        // No throw — the invite should be issued.
        $result = $this->service->invite($org, $inviter, 'left@example.com', MembershipRole::Member);

        expect($result['invitation']->status)->toBe(InvitationStatus::Pending);
    });

    it('throws InvitationAlreadyPendingException when an open invite already exists', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        Invitation::factory()->create([
            'organization_id' => $org->id,
            'email' => 'pending@example.com',
            'status' => InvitationStatus::Pending->value,
        ]);

        expect(fn () => $this->service->invite($org, $inviter, 'PENDING@example.com', MembershipRole::Member))
            ->toThrow(InvitationAlreadyPendingException::class);
    });

    it('throws InvitationRateLimitException at the 21st issuance in 24h', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();

        Invitation::factory()->count(20)->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::now()->subHours(2),
        ]);

        expect(fn () => $this->service->invite($org, $inviter, 'over-limit@example.com', MembershipRole::Member))
            ->toThrow(InvitationRateLimitException::class);
    });
});

// ─── accept() ────────────────────────────────────────────────────────────────

describe('InvitationService::accept()', function (): void {
    it('creates an active membership and marks the invite accepted', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();

        $result = $this->service->invite($org, $inviter, 'joiner@example.com', MembershipRole::Admin);
        $token = $result['token'];
        $joiner = User::factory()->create(['email' => 'joiner@example.com']);

        $membership = $this->service->accept($token, $joiner);

        expect($membership->organization_id)->toBe($org->id);
        expect($membership->user_id)->toBe($joiner->id);
        expect($membership->role)->toBe(MembershipRole::Admin);
        expect($membership->trashed())->toBeFalse();

        $invite = $result['invitation']->fresh();
        expect($invite->status)->toBe(InvitationStatus::Accepted);
        expect($invite->accepted_by_user_id)->toBe($joiner->id);
        expect($invite->accepted_at)->not->toBeNull();
    });

    it('is idempotent on retry — same acceptor reuses the existing membership', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'retry@example.com', MembershipRole::Member)['token'];
        $joiner = User::factory()->create(['email' => 'retry@example.com']);

        $first = $this->service->accept($token, $joiner);
        $second = $this->service->accept($token, $joiner);

        expect($second->id)->toBe($first->id);

        $count = Membership::query()
            ->where('organization_id', $org->id)
            ->where('user_id', $joiner->id)
            ->whereNull('deleted_at')
            ->count();
        expect($count)->toBe(1);
    });

    it('throws InvitationRevokedException when a different identity tries to reuse a consumed token', function (): void {
        // The guarded branch: once `accept()` has consumed the token,
        // any caller whose user_id differs from `accepted_by_user_id`
        // is refused with `invitation_revoked`. To reach this branch
        // the caller's email still has to match the invite (the mismatch
        // guard runs first), so we simulate the realistic scenario where
        // the original local user row was soft-deleted (e.g. account
        // closed) and a new auth identity was provisioned for the same
        // address. The users.email unique index permits a fresh INSERT
        // because the partial active-only index excludes the trashed row.
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'first@example.com', MembershipRole::Member)['token'];

        $first = User::factory()->create(['email' => 'first@example.com']);
        $this->service->accept($token, $first);

        // Hard-delete so the unique users.email constraint frees up for
        // the new identity. accepted_by_user_id is FK with nullOnDelete()
        // so the existing invitation row keeps its `accepted_at` but
        // loses the user reference — the guard's `accepted_by_user_id
        // !== $acceptor->id` check still trips because the second user
        // has a different uuid.
        $first->forceDelete();
        $second = User::factory()->create(['email' => 'first@example.com']);

        expect(fn () => $this->service->accept($token, $second))
            ->toThrow(InvitationRevokedException::class);
    });

    it('throws InvitationEmailMismatchException when the acceptor email differs', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'target@example.com', MembershipRole::Member)['token'];
        $wrong = User::factory()->create(['email' => 'other@example.com']);

        expect(fn () => $this->service->accept($token, $wrong))
            ->toThrow(InvitationEmailMismatchException::class);
    });

    it('throws InvitationExpiredException for past-expiry invites and promotes the row', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'late@example.com', MembershipRole::Member)['token'];

        // Force expiry.
        Invitation::query()->update(['expires_at' => Carbon::now()->subDay()]);

        $joiner = User::factory()->create(['email' => 'late@example.com']);
        expect(fn () => $this->service->accept($token, $joiner))
            ->toThrow(InvitationExpiredException::class);

        // Sweep persisted even though the accept transaction rolled back.
        $invite = Invitation::query()->where('email', 'late@example.com')->firstOrFail();
        expect($invite->status)->toBe(InvitationStatus::Expired);
    });

    it('throws InvitationRevokedException for a revoked invite', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'revoked@example.com', MembershipRole::Member);
        $token = $result['token'];

        $this->service->revoke($result['invitation']);

        $joiner = User::factory()->create(['email' => 'revoked@example.com']);
        expect(fn () => $this->service->accept($token, $joiner))
            ->toThrow(InvitationRevokedException::class);
    });

    it('throws InvitationNotFoundException for an unknown token', function (): void {
        $joiner = User::factory()->create();
        $stranger = str_repeat('Z', 43);

        expect(fn () => $this->service->accept($stranger, $joiner))
            ->toThrow(InvitationNotFoundException::class);
    });

    it('restores a previously soft-deleted membership for the same (org, user)', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $joiner = User::factory()->create(['email' => 'returning@example.com']);

        $previous = Membership::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $joiner->id,
            'role' => MembershipRole::Member,
        ]);
        $previous->delete();

        $token = $this->service->invite($org, $inviter, 'returning@example.com', MembershipRole::Admin)['token'];
        $restored = $this->service->accept($token, $joiner);

        expect($restored->id)->toBe($previous->id);
        expect($restored->trashed())->toBeFalse();
        expect($restored->role)->toBe(MembershipRole::Admin);

        $total = Membership::withTrashed()
            ->where('organization_id', $org->id)
            ->where('user_id', $joiner->id)
            ->count();
        expect($total)->toBe(1);
    });
});

// ─── revoke() ────────────────────────────────────────────────────────────────

describe('InvitationService::revoke()', function (): void {
    it('flips a pending row to revoked and stamps revoked_at', function (): void {
        $org = Organization::factory()->create();
        $invite = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
        ]);

        $this->service->revoke($invite);

        $fresh = $invite->fresh();
        expect($fresh->status)->toBe(InvitationStatus::Revoked);
        expect($fresh->revoked_at)->not->toBeNull();
    });

    it('is a silent no-op on already-non-pending rows (idempotent)', function (): void {
        $org = Organization::factory()->create();
        $invite = Invitation::factory()->accepted()->create([
            'organization_id' => $org->id,
        ]);

        $this->service->revoke($invite);

        expect($invite->fresh()->status)->toBe(InvitationStatus::Accepted);
    });
});

// ─── resend() ────────────────────────────────────────────────────────────────

describe('InvitationService::resend()', function (): void {
    it('rotates the token_hash, resets expires_at, and dispatches a new mail', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'resend@example.com', MembershipRole::Member);
        $originalHash = $result['invitation']->getAttribute('token_hash');
        $originalToken = $result['token'];

        Carbon::setTestNow(Carbon::now()->addHours(1));
        try {
            $resent = $this->service->resend($result['invitation']);
            expect($resent['token'])->not->toBe($originalToken);
            expect($resent['invitation']->getAttribute('token_hash'))->not->toBe($originalHash);
            // The fresh expiry is in the future, ahead of the previous one.
            expect($resent['invitation']->expires_at->greaterThan($result['invitation']->expires_at))->toBeTrue();
        } finally {
            Carbon::setTestNow();
        }

        Mail::assertSent(InvitationMail::class, function (InvitationMail $mail): bool {
            return $mail->hasTo('resend@example.com');
        });
    });

    it('throws InvitationNotPendingException for accepted rows', function (): void {
        $invite = Invitation::factory()->accepted()->create();

        expect(fn () => $this->service->resend($invite))
            ->toThrow(InvitationNotPendingException::class);
    });

    it('throws InvitationNotPendingException for revoked rows', function (): void {
        $invite = Invitation::factory()->revoked()->create();

        expect(fn () => $this->service->resend($invite))
            ->toThrow(InvitationNotPendingException::class);
    });

    it('honours the rate limit on resends', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        Invitation::factory()->count(19)->create([
            'organization_id' => $org->id,
            'created_at' => Carbon::now()->subHours(1),
        ]);
        $target = Invitation::factory()->create([
            'organization_id' => $org->id,
            'status' => InvitationStatus::Pending->value,
            'invited_by_user_id' => $inviter->id,
            'created_at' => Carbon::now()->subHours(1),
        ]);

        expect(fn () => $this->service->resend($target))
            ->toThrow(InvitationRateLimitException::class);
    });

    it('blocks a second resend inside the per-invite cooldown window (R1)', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'cooldown@example.com', MembershipRole::Member);

        // First resend stamps last_resent_at; a second one a few seconds
        // later must trip the cooldown even though no new row is created
        // (so the org-wide created_at limit never sees it).
        Carbon::setTestNow(Carbon::now()->addSeconds(30));
        try {
            $first = $this->service->resend($result['invitation']);

            Carbon::setTestNow(Carbon::now()->addSeconds(10));
            expect(fn () => $this->service->resend($first['invitation']->fresh()))
                ->toThrow(InvitationRateLimitException::class);
        } finally {
            Carbon::setTestNow();
        }
    });

    it('allows a resend once the cooldown window has elapsed (R1)', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'cooldown-ok@example.com', MembershipRole::Member);

        $first = $this->service->resend($result['invitation']);

        Carbon::setTestNow(Carbon::now()->addSeconds(61));
        try {
            $second = $this->service->resend($first['invitation']->fresh());
            expect($second['token'])->not->toBe($first['token']);
        } finally {
            Carbon::setTestNow();
        }
    });
});

// ─── decline() ───────────────────────────────────────────────────────────────

describe('InvitationService::decline()', function (): void {
    it('marks a pending invite as revoked and is idempotent on retry', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'decliner@example.com', MembershipRole::Member);
        $user = User::factory()->create(['email' => 'decliner@example.com']);

        $this->service->decline($result['token'], $user);
        $fresh = $result['invitation']->fresh();
        expect($fresh->status)->toBe(InvitationStatus::Revoked);
        $firstRevokedAt = $fresh->revoked_at;

        // Second call is a no-op (status already terminal).
        $this->service->decline($result['token'], $user);
        expect($result['invitation']->fresh()->revoked_at?->toIso8601String())
            ->toBe($firstRevokedAt?->toIso8601String());

        $this->assertDatabaseMissing('memberships', [
            'organization_id' => $org->id,
            'user_id' => $user->id,
        ]);
    });

    it('throws InvitationEmailMismatchException when the acceptor email differs', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'real@example.com', MembershipRole::Member)['token'];
        $wrong = User::factory()->create(['email' => 'imposter@example.com']);

        expect(fn () => $this->service->decline($token, $wrong))
            ->toThrow(InvitationEmailMismatchException::class);
    });

    it('throws InvitationNotFoundException for an unknown token', function (): void {
        $user = User::factory()->create();
        $stranger = str_repeat('A', 43);

        expect(fn () => $this->service->decline($stranger, $user))
            ->toThrow(InvitationNotFoundException::class);
    });
});

// ─── previewByToken() ────────────────────────────────────────────────────────

describe('InvitationService::previewByToken()', function (): void {
    it('returns a not_found stub for an unknown token (no enumeration)', function (): void {
        $payload = $this->service->previewByToken(str_repeat('Q', 43));

        expect($payload)->toBe(['status' => 'not_found']);
    });

    it('promotes pending → expired on the preview path and returns expired', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $token = $this->service->invite($org, $inviter, 'late@example.com', MembershipRole::Member)['token'];
        Invitation::query()->update(['expires_at' => Carbon::now()->subDay()]);

        $payload = $this->service->previewByToken($token);

        expect($payload['status'])->toBe('expired');
        expect(Invitation::query()->where('email', 'late@example.com')->firstOrFail()->status)
            ->toBe(InvitationStatus::Expired);
    });

    it('returns a pending payload with org + inviter name (no inviter email)', function (): void {
        $org = Organization::factory()->create(['name' => 'Beta Co.', 'slug' => 'beta']);
        $inviter = User::factory()->create(['name' => 'Bob Boss']);
        $token = $this->service->invite($org, $inviter, 'fresh@example.com', MembershipRole::Admin)['token'];

        $payload = $this->service->previewByToken($token);

        expect($payload['status'])->toBe('pending');
        expect($payload['email'])->toBe('fresh@example.com');
        expect($payload['role'])->toBe('admin');
        expect($payload['organization']['id'])->toBe($org->id);
        expect($payload['invited_by'])->toBe(['name' => 'Bob Boss']);
    });

    it('does NOT mutate state on preview for a fresh pending invite', function (): void {
        $org = Organization::factory()->create();
        $inviter = User::factory()->create();
        $result = $this->service->invite($org, $inviter, 'stable@example.com', MembershipRole::Member);

        $this->service->previewByToken($result['token']);

        expect($result['invitation']->fresh()->status)->toBe(InvitationStatus::Pending);
    });
});
