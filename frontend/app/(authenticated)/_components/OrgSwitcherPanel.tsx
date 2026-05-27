'use client';

import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { Plus, Search } from 'lucide-react';

import { t } from '@/lib/i18n/t';
import { normalizeForSearch } from '@/lib/utils/string';
import { Input } from '@/components/ui/Input';
import type { Membership } from '@/lib/types/api';

import { OrgSwitcherOption } from './OrgSwitcherOption';

interface OrgSwitcherPanelProps {
  memberships: Membership[];
  currentOrgId: string | null;
  pendingId: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  onSelect: (m: Membership) => void;
  onOpenCreate: () => void;
}

const SEARCH_THRESHOLD = 8;

/**
 * Conteúdo do popover do OrgSwitcher. Lida com listbox, keyboard nav,
 * typeahead e filtro. As linhas são delegadas a `<OrgSwitcherOption>`.
 */
export function OrgSwitcherPanel({
  memberships,
  currentOrgId,
  pendingId,
  searchQuery,
  setSearchQuery,
  focusIndex,
  setFocusIndex,
  onSelect,
  onOpenCreate,
}: OrgSwitcherPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const typeaheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return memberships;
    const needle = normalizeForSearch(searchQuery);
    return memberships.filter((m) =>
      normalizeForSearch(m.organization.name).includes(needle),
    );
  }, [memberships, searchQuery]);

  useEffect(() => {
    if (memberships.length >= SEARCH_THRESHOLD) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      window.setTimeout(() => optionRefs.current[focusIndex]?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveFocus(next: number) {
    if (filtered.length === 0) return;
    const wrapped = (next + filtered.length) % filtered.length;
    setFocusIndex(wrapped);
    optionRefs.current[wrapped]?.focus();
  }

  function handleTypeahead(char: string) {
    const buf = typeaheadRef.current.buffer + char.toLowerCase();
    typeaheadRef.current.buffer = buf;
    if (typeaheadRef.current.timer) {
      window.clearTimeout(typeaheadRef.current.timer);
    }
    typeaheadRef.current.timer = window.setTimeout(() => {
      typeaheadRef.current.buffer = '';
    }, 500);
    const needle = normalizeForSearch(buf);
    const idx = filtered.findIndex((m) =>
      normalizeForSearch(m.organization.name).startsWith(needle),
    );
    if (idx >= 0) moveFocus(idx);
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(focusIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(focusIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        e.preventDefault();
        moveFocus(filtered.length - 1);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const target = filtered[focusIndex];
        if (target) onSelect(target);
        break;
      }
      default:
        if (memberships.length < SEARCH_THRESHOLD && e.key.length === 1) {
          handleTypeahead(e.key);
        }
    }
  }

  return (
    <>
      <div className="px-3 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {t.orgs.switcher.title}
      </div>

      {memberships.length >= SEARCH_THRESHOLD && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              type="search"
              role="searchbox"
              aria-controls="org-listbox"
              aria-label={t.orgs.switcher.searchLabel}
              placeholder={t.orgs.switcher.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  optionRefs.current[0]?.focus();
                }
              }}
              className="pl-8"
            />
          </div>
        </div>
      )}

      <ul
        id="org-listbox"
        role="listbox"
        aria-label={t.orgs.switcher.listLabel}
        tabIndex={-1}
        className="max-h-[320px] overflow-y-auto px-2 pb-2"
        onKeyDown={handleListKeyDown}
      >
        {filtered.map((m, idx) => (
          <OrgSwitcherOption
            key={m.organization.id}
            ref={(el) => {
              optionRefs.current[idx] = el;
            }}
            membership={m}
            isActive={m.organization.id === currentOrgId}
            isPending={pendingId === m.organization.id}
            isFocused={focusIndex === idx}
            onFocus={() => setFocusIndex(idx)}
            onClick={() => onSelect(m)}
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-text-muted">
            Nenhuma organização encontrada
          </li>
        )}
      </ul>

      <div className="mx-3 my-1 h-px bg-border" aria-hidden="true" />

      <button
        type="button"
        onClick={onOpenCreate}
        className="m-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-accent transition-colors duration-fast ease-standard hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated motion-reduce:transition-none"
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t.orgs.switcher.createCta}
      </button>
    </>
  );
}
