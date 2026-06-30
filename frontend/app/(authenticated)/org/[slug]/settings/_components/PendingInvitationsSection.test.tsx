import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PendingInvitationsSection } from './PendingInvitationsSection';
import { t } from '@/lib/i18n/t';
import type { Invitation, InvitationsListResponse } from '@/lib/types/api';

// Sentinel for rows.
vi.mock('./PendingInvitationRow', () => ({
  PendingInvitationRow: ({ invitation }: { invitation: Invitation }) => (
    <li data-testid="row" data-email={invitation.email}>
      {invitation.email}
    </li>
  ),
}));

// useInvitations: controllable per test.
type QueryState = {
  data: InvitationsListResponse | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};
let queryState: QueryState = {
  data: undefined,
  isPending: false,
  isError: false,
  refetch: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/hooks/use-invitations', () => ({
  useInvitations: () => queryState,
}));

// uiStore — control the collapse pref + spy on setter.
let userPref: boolean | null = null;
const setUserPrefMock = vi.fn((v: boolean | null) => {
  userPref = v;
});
vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (
    selector: (s: {
      invitationsSectionCollapsed: boolean | null;
      setInvitationsSectionCollapsed: typeof setUserPrefMock;
    }) => unknown,
  ) =>
    selector({
      invitationsSectionCollapsed: userPref,
      setInvitationsSectionCollapsed: setUserPrefMock,
    }),
}));

function makeInvitation(overrides: Partial<Invitation>): Invitation {
  return {
    id: overrides.id ?? 'inv-x',
    organization_id: 'org-1',
    email: overrides.email ?? 'x@acme.com',
    role: 'member',
    status: overrides.status ?? 'pending',
    expires_at: '2099-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    accepted_at: null,
    revoked_at: null,
    resent_at: null,
    invited_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  userPref = null;
  setUserPrefMock.mockReset();
  queryState = {
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PendingInvitationsSection — loading state', () => {
  it('renders the skeleton when query is pending and no data is cached yet', () => {
    queryState.isPending = true;
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    // Skeleton has aria-busy.
    expect(screen.getByRole('list', { hidden: false }))
      .toHaveAttribute('aria-busy', 'true');
  });
});

describe('PendingInvitationsSection — error state', () => {
  it('renders an error alert with a retry button', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    queryState = {
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    };

    const user = userEvent.setup();
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    expect(
      screen.getByText(t.invitations.list.loadingError),
    ).toBeInTheDocument();

    const retry = screen.getByRole('button', {
      name: t.invitations.list.retry,
    });
    await user.click(retry);
    expect(refetch).toHaveBeenCalled();
  });
});

describe('PendingInvitationsSection — empty state', () => {
  it('renders the empty hint when there are no pending invitations', () => {
    queryState.data = { data: [] };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    expect(
      screen.getByText(t.invitations.list.emptyTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.invitations.list.emptyHint),
    ).toBeInTheDocument();
  });

  it('filters out non-pending invitations before evaluating "empty"', () => {
    queryState.data = {
      data: [
        makeInvitation({ id: 'i1', email: 'a@acme.com', status: 'accepted' }),
        makeInvitation({ id: 'i2', email: 'b@acme.com', status: 'revoked' }),
      ],
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    expect(
      screen.getByText(t.invitations.list.emptyTitle),
    ).toBeInTheDocument();
  });
});

describe('PendingInvitationsSection — list rendering', () => {
  it('renders one row per pending invitation', () => {
    queryState.data = {
      data: [
        makeInvitation({ id: 'i1', email: 'a@acme.com' }),
        makeInvitation({ id: 'i2', email: 'b@acme.com' }),
      ],
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.dataset.email)).toEqual([
      'a@acme.com',
      'b@acme.com',
    ]);
  });

  it('shows the count in the heading', () => {
    queryState.data = {
      data: [
        makeInvitation({ id: 'i1', email: 'a@acme.com' }),
        makeInvitation({ id: 'i2', email: 'b@acme.com' }),
      ],
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    expect(
      screen.getByRole('heading', {
        name: t.invitations.list.sectionTitleWithCount(2),
      }),
    ).toBeInTheDocument();
  });
});

describe('PendingInvitationsSection — collapse toggle', () => {
  it('defaults to expanded when count <= 5', () => {
    queryState.data = {
      data: Array.from({ length: 3 }, (_, i) =>
        makeInvitation({ id: `i${i}`, email: `u${i}@acme.com` }),
      ),
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    const toggle = screen.getByRole('button', {
      name: t.invitations.list.collapseToggleHide,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('row')).toHaveLength(3);
  });

  it('defaults to collapsed when count > 5', () => {
    queryState.data = {
      data: Array.from({ length: 7 }, (_, i) =>
        makeInvitation({ id: `i${i}`, email: `u${i}@acme.com` }),
      ),
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    const toggle = screen.getByRole('button', {
      name: t.invitations.list.collapseToggleShow,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The list container is hidden via the [hidden] attribute.
    const list = document.getElementById('pending-invites-list');
    expect(list).toHaveAttribute('hidden');
  });

  it('calls setUserPref(true) when collapsing an expanded section', async () => {
    const user = userEvent.setup();
    queryState.data = {
      data: [makeInvitation({ id: 'i1', email: 'a@acme.com' })],
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    await user.click(
      screen.getByRole('button', {
        name: t.invitations.list.collapseToggleHide,
      }),
    );
    expect(setUserPrefMock).toHaveBeenCalledWith(true);
  });

  it('honours an explicit user preference over the default heuristic', () => {
    userPref = true; // force collapsed even with 1 row
    queryState.data = {
      data: [makeInvitation({ id: 'i1', email: 'a@acme.com' })],
    };
    render(<PendingInvitationsSection orgId="org-1" viewerRole="owner" />);

    const toggle = screen.getByRole('button', {
      name: t.invitations.list.collapseToggleShow,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
