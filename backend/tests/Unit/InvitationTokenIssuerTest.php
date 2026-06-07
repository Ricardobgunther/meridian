<?php

declare(strict_types=1);

use App\Exceptions\Domain\InvitationNotFoundException;
use App\Models\Invitation;
use App\Services\InvitationTokenIssuer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| InvitationTokenIssuer — unit tests
|--------------------------------------------------------------------------
|
| Token mint + hash + lookup, extracted from InvitationService (R3). The
| service-level tests already exercise these paths indirectly; this suite
| pins the collaborator's contract directly now that it is public API.
| Mirrors InvitationServiceTest: opt into TestCase + RefreshDatabase
| explicitly because tests/Pest.php only applies them under Feature/.
|
*/
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    $this->issuer = app(InvitationTokenIssuer::class);
});

describe('generate', function (): void {
    it('mints a 43-char URL-safe base64url token with no padding', function (): void {
        $token = $this->issuer->generate();

        // 32 random bytes → 43 base64 chars once '=' padding is stripped.
        expect($token)->toHaveLength(43)
            ->and($token)->toMatch('/^[A-Za-z0-9_-]+$/'); // url-safe alphabet, no + / =
    });

    it('mints a distinct token on each call', function (): void {
        $tokens = collect(range(1, 50))->map(fn (): string => $this->issuer->generate());

        expect($tokens->unique())->toHaveCount(50);
    });
});

describe('hash', function (): void {
    it('derives a deterministic SHA-256 hex digest of the raw token', function (): void {
        expect($this->issuer->hash('the-raw-token'))
            ->toBe(hash('sha256', 'the-raw-token'))
            ->toHaveLength(64);
    });

    it('derives different digests for different tokens', function (): void {
        expect($this->issuer->hash('token-a'))
            ->not->toBe($this->issuer->hash('token-b'));
    });
});

describe('find', function (): void {
    it('resolves the invitation whose stored hash matches the raw token', function (): void {
        $raw = $this->issuer->generate();
        $invitation = Invitation::factory()->forToken($raw)->create();

        expect($this->issuer->find($raw)?->id)->toBe($invitation->id);
    });

    it('returns null for a token that matches no row', function (): void {
        Invitation::factory()->forToken('some-other-token')->create();

        expect($this->issuer->find('unknown-token'))->toBeNull();
    });

    it('ignores soft-deleted invitations', function (): void {
        $raw = $this->issuer->generate();
        Invitation::factory()->forToken($raw)->create()->delete();

        expect($this->issuer->find($raw))->toBeNull();
    });
});

describe('findForUpdate', function (): void {
    it('resolves and returns the matching invitation', function (): void {
        $raw = $this->issuer->generate();
        $invitation = Invitation::factory()->forToken($raw)->create();

        expect($this->issuer->findForUpdate($raw)->id)->toBe($invitation->id);
    });

    it('throws InvitationNotFoundException when no row matches', function (): void {
        $this->issuer->findForUpdate('unknown-token');
    })->throws(InvitationNotFoundException::class);

    it('treats a soft-deleted invitation as not found', function (): void {
        $raw = $this->issuer->generate();
        Invitation::factory()->forToken($raw)->create()->delete();

        $this->issuer->findForUpdate($raw);
    })->throws(InvitationNotFoundException::class);
});
