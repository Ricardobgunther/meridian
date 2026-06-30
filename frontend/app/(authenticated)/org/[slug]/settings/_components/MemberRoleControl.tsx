'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Lock } from 'lucide-react';

import { t } from '@/lib/i18n/t';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { Role } from '@/lib/types/api';

export const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

/**
 * Funções selecionáveis no dropdown. `owner` está fora de propósito:
 * o backend rejeita `role=owner` via PATCH (ver UpdateMembershipRequest);
 * transferência de propriedade ainda não é suportada.
 */
export type AssignableRole = Exclude<Role, 'owner'>;
const ROLE_OPTIONS: AssignableRole[] = ['admin', 'member'];

interface MemberRoleControlProps {
  currentRole: Role;
  memberName: string;
  viewerRole: Role;
  canChangeRole: boolean;
  lockReason: string;
  onSelect: (role: AssignableRole) => void;
}

/**
 * Dropdown ou badge bloqueado para a coluna "função" da linha do membro.
 *
 * - Se a função atual for `owner`, sempre renderiza o badge bloqueado:
 *   o dono é o único que poderia abrir mão do posto e ainda não há fluxo
 *   de transferência. Demoção via menu de admin é tratada à parte.
 */
export function MemberRoleControl({
  currentRole,
  memberName,
  viewerRole,
  canChangeRole,
  lockReason,
  onSelect,
}: MemberRoleControlProps) {
  if (!canChangeRole || currentRole === 'owner') {
    return (
      <span className="flex items-center gap-1.5" title={lockReason || undefined}>
        <RoleBadge role={currentRole} />
        {lockReason && (
          <Lock className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
        )}
      </span>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t.settings.members.roleTrigger(
            memberName,
            t.orgs.roleFull[currentRole],
          )}
          className="rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RoleBadge role={currentRole} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-dropdown w-44 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg"
        >
          {ROLE_OPTIONS.filter(
            (r) => ROLE_RANK[r] <= ROLE_RANK[viewerRole],
          ).map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onSelect(option)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none"
            >
              <span className="flex-1">{t.orgs.roleFull[option]}</span>
              {option === currentRole && (
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
