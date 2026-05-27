<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Auth\UserProvisioningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

// Unit tests in Pest's `Unit/` directory don't bind to Tests\TestCase by
// default (the global `pest()->extend(...)` call in `Pest.php` scopes to
// Feature/), so opt in here to gain Laravel bootstrapping + RefreshDatabase.
uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    $this->service = app(UserProvisioningService::class);
});

it('inserts a new user using the JWT sub as primary key', function (): void {
    $sub = '11111111-2222-3333-4444-555555555555';

    $user = $this->service->provisionFromClaims([
        'sub' => $sub,
        'email' => 'new.user@example.com',
        'user_metadata' => [
            'full_name' => 'New User',
            'avatar_url' => 'https://cdn.example.com/new.png',
        ],
    ]);

    expect($user)->toBeInstanceOf(User::class);
    expect($user->id)->toBe($sub);
    expect($user->email)->toBe('new.user@example.com');
    expect($user->name)->toBe('New User');
    expect($user->avatar_url)->toBe('https://cdn.example.com/new.png');
    expect($user->last_seen_at)->not->toBeNull();

    $this->assertDatabaseHas('users', [
        'id' => $sub,
        'email' => 'new.user@example.com',
        'name' => 'New User',
        'avatar_url' => 'https://cdn.example.com/new.png',
    ]);
    $this->assertDatabaseCount('users', 1);
});

it('updates last_seen_at and mutable claims on re-provisioning without changing id or created_at', function (): void {
    $sub = '11111111-2222-3333-4444-555555555555';

    // First login at T0.
    Carbon::setTestNow('2026-05-01 10:00:00');
    $first = $this->service->provisionFromClaims([
        'sub' => $sub,
        'email' => 'jane@example.com',
        'user_metadata' => ['full_name' => 'Jane Old', 'avatar_url' => 'https://cdn.example.com/old.png'],
    ]);

    $originalCreatedAt = $first->created_at;

    // Second login later — name and avatar both changed in Supabase.
    Carbon::setTestNow('2026-05-10 12:30:00');
    $second = $this->service->provisionFromClaims([
        'sub' => $sub,
        'email' => 'jane@example.com',
        'user_metadata' => ['full_name' => 'Jane New', 'avatar_url' => 'https://cdn.example.com/new.png'],
    ]);

    expect($second->id)->toBe($sub);
    expect($second->name)->toBe('Jane New');
    expect($second->avatar_url)->toBe('https://cdn.example.com/new.png');
    expect($second->last_seen_at?->toIso8601String())->toBe(Carbon::parse('2026-05-10 12:30:00')->toIso8601String());

    // created_at is preserved across re-provisioning.
    expect($second->created_at?->equalTo($originalCreatedAt))->toBeTrue();

    // Still only one row — re-provisioning never inserts a duplicate.
    $this->assertDatabaseCount('users', 1);

    Carbon::setTestNow();
});

it('restores a soft-deleted user on re-login', function (): void {
    $sub = '11111111-2222-3333-4444-555555555555';

    // Provision then soft-delete the user.
    $user = $this->service->provisionFromClaims([
        'sub' => $sub,
        'email' => 'returning@example.com',
        'user_metadata' => ['full_name' => 'Returning User'],
    ]);
    $user->delete();

    expect(User::withTrashed()->find($sub)?->trashed())->toBeTrue();

    // Re-login should restore the row, not 404 / not create a duplicate.
    $restored = $this->service->provisionFromClaims([
        'sub' => $sub,
        'email' => 'returning@example.com',
        'user_metadata' => ['full_name' => 'Returning User'],
    ]);

    expect($restored->trashed())->toBeFalse();
    expect($restored->id)->toBe($sub);
    $this->assertDatabaseCount('users', 1);
    $this->assertDatabaseHas('users', ['id' => $sub, 'deleted_at' => null]);
});

it('throws when the sub claim is missing', function (): void {
    $this->service->provisionFromClaims([
        'email' => 'no-sub@example.com',
    ]);
})->throws(InvalidArgumentException::class, 'sub');

it('throws when the sub claim is an empty string', function (): void {
    $this->service->provisionFromClaims([
        'sub' => '',
        'email' => 'empty-sub@example.com',
    ]);
})->throws(InvalidArgumentException::class, 'sub');

it('throws when the email claim is missing', function (): void {
    $this->service->provisionFromClaims([
        'sub' => '11111111-2222-3333-4444-555555555555',
    ]);
})->throws(InvalidArgumentException::class, 'email');
