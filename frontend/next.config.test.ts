import { describe, expect, it } from 'vitest';

import nextConfig from './next.config.mjs';

/*
 * Pins the security headers declared in next.config.mjs without booting Next.
 * The headers() config is a plain async function returning a rules array, so
 * we can assert its output directly. Guards follow-up R10: the invitation
 * token sits in the /invite/<token> path and must not leak via Referer.
 */
interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

describe('next.config headers()', () => {
  it('sends Referrer-Policy: no-referrer for /invite/* so the token never leaks via Referer', async () => {
    expect(nextConfig.headers).toBeDefined();
    const rules = (await nextConfig.headers!()) as unknown as HeaderRule[];

    const inviteRule = rules.find((r) => r.source === '/invite/:path*');

    expect(
      inviteRule,
      'expected a header rule scoped to /invite/:path*',
    ).toBeDefined();
    expect(inviteRule?.headers).toContainEqual({
      key: 'Referrer-Policy',
      value: 'no-referrer',
    });
  });
});
