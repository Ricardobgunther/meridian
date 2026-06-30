import { describe, expect, it } from 'vitest';

import { isValidSlug, normalizeForSearch, slugify } from './string';

describe('slugify', () => {
  it('lowercases and strips diacritics', () => {
    expect(slugify('Acme Brasíl')).toBe('acme-brasil');
  });

  it('collapses runs of non-alnum to single hyphen', () => {
    expect(slugify('Hello   World!! 2026')).toBe('hello-world-2026');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('---Acme---')).toBe('acme');
  });

  it('truncates to maxLen', () => {
    expect(slugify('a'.repeat(100), 10)).toBe('a'.repeat(10));
  });

  it('returns empty string for input with no alnum chars', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts kebab-case lowercased ids', () => {
    expect(isValidSlug('acme')).toBe(true);
    expect(isValidSlug('acme-brasil')).toBe(true);
    expect(isValidSlug('acme-br-2026')).toBe(true);
  });

  it('rejects uppercase, spaces, and underscores', () => {
    expect(isValidSlug('Acme')).toBe(false);
    expect(isValidSlug('acme brasil')).toBe(false);
    expect(isValidSlug('acme_br')).toBe(false);
  });

  it('rejects leading/trailing/double hyphens', () => {
    expect(isValidSlug('-acme')).toBe(false);
    expect(isValidSlug('acme-')).toBe(false);
    expect(isValidSlug('acme--brasil')).toBe(false);
  });
});

describe('normalizeForSearch', () => {
  it('lowercases, strips diacritics and trims', () => {
    expect(normalizeForSearch('  Açúcar Brasíl  ')).toBe('acucar brasil');
  });
});
