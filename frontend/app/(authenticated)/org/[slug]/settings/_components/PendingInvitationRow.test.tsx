import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PendingInvitationRow } from './PendingInvitationRow';
import { t } from '@/lib/i18n/t';
import type { Invitation, InvitationInviter, Role } from '@/lib/types/api';

// The actions menu uses hooks & a portal — replace it with a sentinel so we
// can assert "is the menu rendered?" without booting Radix or TanStack here.
vi.mock('./InvitationActionsMenu', () => ({
  InvitationActionsMenu: () => <div data-testid="actions-menu-sentinel" />,
}));

const FIXED_NOW = new Date('2026-05-28T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeInviter(overrides: Partial<InvitationInviter> = {}): InvitationInviter {
  return {
    id: 'usr-1',
    name: 'Ada Lovelace',
    email: 'ada@acme.com',
    is_active_member: true,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    organization_id: 'org-1',
    email: 'bruno@acme.com',
    role: 'member',
    status: 'pending',
    expires_at: new Date(FIXED_NOW.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: FIXED_NOW.toISOString(),
    accepted_at: null,
    revoked_at: null,
    resent_at: null,
    invited_by: makeInviter(),
    ...overrides,
  };
}

function renderRow(invitation: Invitation, viewerRole: Role) {
  return render(
    <ul>
      <PendingInvitationRow
        invitation={invitation}
        orgId="org-1"
        viewerRole={viewerRole}
      />
    </ul>,
  );
}

describe('PendingInvitationRow', () => {
  it('renders the invitee email and a role badge', () => {
    renderRow(makeInvitation({ role: 'member' }), 'owner');

    expect(screen.getByText('bruno@acme.com')).toBeInTheDocument();
    // RoleBadge for "member" uses the short label "Membro".
    expect(screen.getByText('Membro')).toBeInTheDocument();
  });

  it('renders the admin badge label when role is admin', () => {
    renderRow(makeInvitation({ role: 'admin' }), 'owner');

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders inviter name when present and active', () => {
    renderRow(makeInvitation({ invited_by: makeInviter() }), 'owner');

    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
  });

  it('falls back to inviter email when name is null', () => {
    renderRow(
      makeInvitation({
        invited_by: makeInviter({ name: null, email: 'noname@acme.com' }),
      }),
      'owner',
    );

    expect(screen.getByText(/noname@acme.com/)).toBeInTheDocument();
  });

  it('exposes the "no longer member" hint via title attr when inviter is inactive', () => {
    const { container } = renderRow(
      makeInvitation({
        invited_by: makeInviter({ is_active_member: false, name: 'Ada Lovelace' }),
      }),
      'owner',
    );
    // Search for an element with the inactive title tooltip.
    expect(
      container.querySelector(
        `[title="${t.invitations.list.inviterNoLongerMember}"]`,
      ),
    ).not.toBeNull();
  });

  it('renders the expiration pill ("em N dias")', () => {
    renderRow(makeInvitation(), 'owner');

    expect(screen.getByText(/em 6 dias/i)).toBeInTheDocument();
  });

  it('renders the actions menu when viewer is owner', () => {
    renderRow(makeInvitation(), 'owner');
    expect(screen.getByTestId('actions-menu-sentinel')).toBeInTheDocument();
  });

  it('renders the actions menu when viewer is admin', () => {
    renderRow(makeInvitation(), 'admin');
    expect(screen.getByTestId('actions-menu-sentinel')).toBeInTheDocument();
  });

  it('does NOT render the actions menu when viewer is plain member', () => {
    renderRow(makeInvitation(), 'member');
    expect(
      screen.queryByTestId('actions-menu-sentinel'),
    ).not.toBeInTheDocument();
  });
});
