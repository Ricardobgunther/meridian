import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getCurrentOrgId,
  resolveCurrentOrgId,
  setCurrentOrgId,
} from './current';
import type { Membership } from '@/lib/types/api';

function makeMembership(id: string, name = `Org ${id}`): Membership {
  return {
    id: `mem-${id}`,
    role: 'member',
    joined_at: '2025-01-01T00:00:00Z',
    organization: { id, slug: name.toLowerCase().replace(/\s+/g, '-'), name },
  };
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.split('=')[1] ?? '';
  return decodeURIComponent(value);
}

function clearAllCookies(): void {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

describe('current org resolution', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAllCookies();
  });

  afterEach(() => {
    window.localStorage.clear();
    clearAllCookies();
  });

  it('persists and reads from localStorage', () => {
    setCurrentOrgId('abc');
    expect(getCurrentOrgId()).toBe('abc');
  });

  it('clears storage when passed null', () => {
    setCurrentOrgId('abc');
    setCurrentOrgId(null);
    expect(getCurrentOrgId()).toBeNull();
  });

  it('returns stored id when it exists in memberships', () => {
    setCurrentOrgId('b');
    const resolved = resolveCurrentOrgId([
      makeMembership('a'),
      makeMembership('b'),
    ]);
    expect(resolved).toBe('b');
  });

  it('falls back to first membership when stored value is stale', () => {
    setCurrentOrgId('stale');
    const resolved = resolveCurrentOrgId([
      makeMembership('first'),
      makeMembership('second'),
    ]);
    expect(resolved).toBe('first');
    expect(getCurrentOrgId()).toBe('first');
  });

  it('returns null and clears storage on empty memberships', () => {
    setCurrentOrgId('anything');
    const resolved = resolveCurrentOrgId([]);
    expect(resolved).toBeNull();
    expect(getCurrentOrgId()).toBeNull();
  });

  it('keeps stored id when it matches first membership too (idempotent)', () => {
    setCurrentOrgId('a');
    const resolved = resolveCurrentOrgId([
      makeMembership('a'),
      makeMembership('b'),
    ]);
    expect(resolved).toBe('a');
    expect(getCurrentOrgId()).toBe('a');
  });

  it('does not write the decorative current_organization_id cookie', () => {
    setCurrentOrgId('abc');
    expect(getCookie('current_organization_id')).toBeNull();
  });

  it('expires a legacy cookie left over from previous deploys', () => {
    document.cookie =
      'current_organization_id=legacy-value; Path=/; SameSite=Lax';
    expect(getCookie('current_organization_id')).toBe('legacy-value');
    setCurrentOrgId('abc');
    expect(getCookie('current_organization_id')).toBeNull();
  });
});
