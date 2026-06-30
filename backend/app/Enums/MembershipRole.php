<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Fixed RBAC roles for `memberships.role` — ADR-010.
 *
 * The hierarchy (owner > admin > member) is encoded by {@see self::rank()}
 * and consumed by {@see self::outranks()} to keep role-elevation checks
 * in one place. Adding a role here is a breaking change — also update the
 * Postgres CHECK constraint in the memberships migration.
 */
enum MembershipRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';

    /**
     * Owners and admins may invite/remove members and edit other
     * memberships, subject to the {@see self::outranks()} rule below.
     */
    public function canManageMembers(): bool
    {
        return match ($this) {
            self::Owner, self::Admin => true,
            self::Member => false,
        };
    }

    /**
     * Only the owner may destroy the organization. Admins can manage
     * members but never delete the tenant root.
     */
    public function canDeleteOrganization(): bool
    {
        return $this === self::Owner;
    }

    /**
     * True when `$this` is strictly higher in the hierarchy than `$other`.
     *
     * Used to prevent role changes that would let an admin demote an
     * owner, or a member edit anyone. Equal ranks do NOT outrank each
     * other — admins cannot modify other admins via this check.
     */
    public function outranks(self $other): bool
    {
        return $this->rank() > $other->rank();
    }

    private function rank(): int
    {
        return match ($this) {
            self::Owner => 3,
            self::Admin => 2,
            self::Member => 1,
        };
    }
}
