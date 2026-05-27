'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

export type ActiveModal =
  | null
  | { kind: 'create-org' }
  | { kind: 'confirm-delete-org'; orgId: string; orgName: string }
  | { kind: 'confirm-remove-member'; memberId: string; memberName: string }
  | { kind: 'confirm-slug-change'; oldSlug: string; newSlug: string };

export interface UiState {
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  theme: Theme;
  activeModal: ActiveModal;

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileDrawer: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  openModal: (m: NonNullable<ActiveModal>) => void;
  closeModal: () => void;
}

/**
 * Store global de UI (Zustand + persist).
 *
 * Persiste apenas `sidebarCollapsed` e `theme` — `mobileDrawerOpen` e
 * `activeModal` são sempre voláteis (não devem sobreviver ao reload).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileDrawerOpen: false,
      theme: 'system',
      activeModal: null,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileDrawer: (v) => set({ mobileDrawerOpen: v }),
      setTheme: (t) => set({ theme: t }),
      openModal: (m) => set({ activeModal: m }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      // Allowlist explícita — qualquer outro campo é volátil.
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
      }),
      version: 1,
    },
  ),
);
