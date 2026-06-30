'use client';

import { forwardRef } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import type { Membership } from '@/lib/types/api';

interface OrgSwitcherOptionProps {
  membership: Membership;
  isActive: boolean;
  isPending: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onClick: () => void;
}

/**
 * Linha individual do listbox do OrgSwitcher. Renderiza avatar + nome
 * truncado + badge de role + check/spinner. Mantida pequena e tipada.
 */
export const OrgSwitcherOption = forwardRef<
  HTMLLIElement,
  OrgSwitcherOptionProps
>(function OrgSwitcherOption(
  { membership, isActive, isPending, isFocused, onFocus, onClick },
  ref,
) {
  return (
    <li
      ref={ref}
      role="option"
      aria-selected={isActive}
      aria-busy={isPending}
      tabIndex={isFocused ? 0 : -1}
      onFocus={onFocus}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-standard motion-reduce:transition-none',
        isActive
          ? 'bg-accent-soft text-accent'
          : 'text-text-primary hover:bg-surface-sunken focus:bg-surface-sunken',
        isPending && 'opacity-50',
      )}
    >
      <Avatar
        seed={membership.organization.id}
        label={membership.organization.name}
        size={28}
      />
      <span className="min-w-0 flex-1 truncate">
        {membership.organization.name}
      </span>
      <RoleBadge role={membership.role} />
      {isPending ? (
        <SpinnerIcon className="h-4 w-4 text-accent" />
      ) : isActive ? (
        <Check className="h-4 w-4 text-accent" aria-hidden="true" />
      ) : null}
    </li>
  );
});
