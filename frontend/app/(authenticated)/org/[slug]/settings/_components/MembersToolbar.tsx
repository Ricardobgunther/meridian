'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n/t';
import type { Role } from '@/lib/types/api';

export type RoleFilter = Role | 'all';

interface MembersToolbarProps {
  searchInput: string;
  roleFilter: RoleFilter;
  onSearchChange: (v: string) => void;
  onRoleFilterChange: (v: RoleFilter) => void;
}

const ROLE_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: t.settings.members.roleFilterAll },
  { value: 'owner', label: t.settings.members.roleFilterOwners },
  { value: 'admin', label: t.settings.members.roleFilterAdmins },
  { value: 'member', label: t.settings.members.roleFilterMembers },
];

/**
 * Search + role filter da aba Membros. Stateless — toda lógica de debounce
 * e paginação vive no MembersTab.
 */
export function MembersToolbar({
  searchInput,
  roleFilter,
  onSearchChange,
  onRoleFilterChange,
}: MembersToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={t.settings.members.searchPlaceholder}
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          aria-label={t.settings.members.searchPlaceholder}
        />
      </div>
      <label className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-text-muted">
          {t.settings.members.roleFilter}:
        </span>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
