<?php

declare(strict_types=1);

use App\Enums\MembershipRole;

describe('MembershipRole::outranks()', function (): void {
    it('reports owner as strictly higher than admin and member', function (): void {
        expect(MembershipRole::Owner->outranks(MembershipRole::Admin))->toBeTrue();
        expect(MembershipRole::Owner->outranks(MembershipRole::Member))->toBeTrue();
    });

    it('reports admin as strictly higher than member only', function (): void {
        expect(MembershipRole::Admin->outranks(MembershipRole::Member))->toBeTrue();
        expect(MembershipRole::Admin->outranks(MembershipRole::Owner))->toBeFalse();
    });

    it('reports member as outranking nobody', function (): void {
        expect(MembershipRole::Member->outranks(MembershipRole::Admin))->toBeFalse();
        expect(MembershipRole::Member->outranks(MembershipRole::Owner))->toBeFalse();
    });

    it('does not consider equal ranks as outranking each other', function (MembershipRole $role): void {
        expect($role->outranks($role))->toBeFalse();
    })->with([
        'owner vs owner' => [MembershipRole::Owner],
        'admin vs admin' => [MembershipRole::Admin],
        'member vs member' => [MembershipRole::Member],
    ]);
});

describe('MembershipRole::canManageMembers()', function (): void {
    it('allows owner and admin to manage members', function (): void {
        expect(MembershipRole::Owner->canManageMembers())->toBeTrue();
        expect(MembershipRole::Admin->canManageMembers())->toBeTrue();
    });

    it('denies regular members from managing the roster', function (): void {
        expect(MembershipRole::Member->canManageMembers())->toBeFalse();
    });
});

describe('MembershipRole::canDeleteOrganization()', function (): void {
    it('only allows the owner to delete the organization', function (): void {
        expect(MembershipRole::Owner->canDeleteOrganization())->toBeTrue();
        expect(MembershipRole::Admin->canDeleteOrganization())->toBeFalse();
        expect(MembershipRole::Member->canDeleteOrganization())->toBeFalse();
    });
});
