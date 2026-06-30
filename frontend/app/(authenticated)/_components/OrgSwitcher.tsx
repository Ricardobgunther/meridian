'use client';

import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/lib/stores/ui-store';
import { useSwitchOrg } from '@/hooks/use-switch-org';
import type { Membership } from '@/lib/types/api';

import { OrgSwitcherPanel } from './OrgSwitcherPanel';

interface OrgSwitcherProps {
  memberships: Membership[];
  currentOrgId: string | null;
  /** Mostra empty state quando memberships=[]. */
  showEmptyCta?: boolean;
}

/**
 * Trigger + popover do switcher de organizações.
 *
 * - Trigger: avatar + nome + caret (max-w-60, truncate).
 * - Empty state (sem orgs): botão "+ Criar organização" (ADR-012).
 * - Popover delega para `<OrgSwitcherPanel>` o conteúdo do listbox.
 */
export function OrgSwitcher({
  memberships,
  currentOrgId,
  showEmptyCta,
}: OrgSwitcherProps) {
  const openModal = useUiStore((s) => s.openModal);
  const { switchOrg, pendingId } = useSwitchOrg();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reseta busca e ajusta foco inicial para o item ativo.
      setSearchQuery('');
      const activeIdx = memberships.findIndex(
        (m) => m.organization.id === currentOrgId,
      );
      setFocusIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  }

  function handleSelect(m: Membership) {
    setOpen(false);
    void switchOrg({ id: m.organization.id, name: m.organization.name });
  }

  function handleOpenCreate() {
    setOpen(false);
    openModal({ kind: 'create-org' });
  }

  // Empty state.
  if (showEmptyCta) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={handleOpenCreate}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t.orgs.switcher.createCta}
      </Button>
    );
  }

  const currentMembership = memberships.find(
    (m) => m.organization.id === currentOrgId,
  );
  const currentName = currentMembership?.organization.name ?? '';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="org-listbox"
          aria-label={t.orgs.switcher.triggerLabel(currentName)}
          className={cn(
            'flex max-w-60 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors duration-fast ease-standard',
            'hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            open && 'bg-surface-elevated',
            'motion-reduce:transition-none',
          )}
        >
          {currentMembership && (
            <Avatar
              seed={currentMembership.organization.id}
              label={currentMembership.organization.name}
              size={28}
            />
          )}
          <span className="max-w-40 truncate font-medium text-text-primary">
            {currentName}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-text-muted transition-transform duration-fast ease-standard motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-dropdown w-[300px] rounded-lg border border-border bg-surface-elevated shadow-lg',
            'data-[state=open]:animate-slide-up motion-reduce:animate-none',
          )}
        >
          <OrgSwitcherPanel
            memberships={memberships}
            currentOrgId={currentOrgId}
            pendingId={pendingId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            focusIndex={focusIndex}
            setFocusIndex={setFocusIndex}
            onSelect={handleSelect}
            onOpenCreate={handleOpenCreate}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
