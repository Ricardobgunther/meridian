'use client';

import * as Dialog from '@radix-ui/react-dialog';

import { useUiStore } from '@/lib/stores/ui-store';
import { Sidebar } from './Sidebar';

interface MobileDrawerProps {
  activeOrgSlug: string | null;
}

/**
 * Drawer mobile (slide-in da esquerda). Em ≥lg fica oculto via CSS no
 * próprio Shell. Radix Dialog cuida do focus trap + Esc + backdrop click.
 */
export function MobileDrawer({ activeOrgSlug }: MobileDrawerProps) {
  const open = useUiStore((s) => s.mobileDrawerOpen);
  const setOpen = useUiStore((s) => s.setMobileDrawer);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-overlay data-[state=open]:animate-fade-in motion-reduce:animate-none lg:hidden" />
        <Dialog.Content
          aria-label="Menu de navegação"
          className="fixed inset-y-0 left-0 z-modal flex outline-none data-[state=open]:animate-slide-in-left motion-reduce:animate-none lg:hidden"
        >
          <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
          <Sidebar
            activeOrgSlug={activeOrgSlug}
            mobile
            onNavigate={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
