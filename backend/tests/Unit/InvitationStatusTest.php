<?php

declare(strict_types=1);

use App\Enums\InvitationStatus;

describe('InvitationStatus', function (): void {
    it('exposes exactly four cases — pending/accepted/revoked/expired', function (): void {
        $values = collect(InvitationStatus::cases())->map(fn ($c) => $c->value)->all();

        expect($values)->toBe(['pending', 'accepted', 'revoked', 'expired']);
    });

    it('maps every case to a PT-BR label', function (InvitationStatus $status, string $expected): void {
        expect($status->label())->toBe($expected);
    })->with([
        'pending'  => [InvitationStatus::Pending, 'Pendente'],
        'accepted' => [InvitationStatus::Accepted, 'Aceito'],
        'revoked'  => [InvitationStatus::Revoked, 'Revogado'],
        'expired'  => [InvitationStatus::Expired, 'Expirado'],
    ]);

    it('reverse-resolves from string via tryFrom()', function (): void {
        expect(InvitationStatus::tryFrom('pending'))->toBe(InvitationStatus::Pending);
        expect(InvitationStatus::tryFrom('accepted'))->toBe(InvitationStatus::Accepted);
        expect(InvitationStatus::tryFrom('revoked'))->toBe(InvitationStatus::Revoked);
        expect(InvitationStatus::tryFrom('expired'))->toBe(InvitationStatus::Expired);
        // Unknown values resolve to null (no DB-side enum drift).
        expect(InvitationStatus::tryFrom('archived'))->toBeNull();
    });
});
