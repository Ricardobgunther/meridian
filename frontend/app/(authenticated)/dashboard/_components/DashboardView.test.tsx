import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardView } from './DashboardView';
import { t } from '@/lib/i18n/t';
import type { Membership, Organization, Role } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

interface MeState {
  isPending: boolean;
  data?: {
    user: { id: string; name: string | null; email: string };
    memberships: Membership[];
  };
}
let meState: MeState;
vi.mock('@/hooks/use-me', () => ({ useMe: () => meState }));

interface CurrentOrgState {
  orgId: string | null;
  membership: Membership | null;
  organization: Organization | null;
  role: Role | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
let currentOrgState: CurrentOrgState;
vi.mock('@/hooks/use-current-org', () => ({
  useCurrentOrg: () => currentOrgState,
}));

interface CountQueryState {
  data?: { meta?: { total: number }; data: unknown[] };
  isError: boolean;
  refetch: () => Promise<unknown>;
}
let membersState: CountQueryState;
vi.mock('@/hooks/use-members', () => ({ useMembers: () => membersState }));

let invitationsState: CountQueryState;
vi.mock('@/hooks/use-invitations', () => ({
  useInvitations: () => invitationsState,
}));

const openModalMock = vi.fn();
vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (selector: (s: { openModal: typeof openModalMock }) => unknown) =>
    selector({ openModal: openModalMock }),
}));

// --- Fixtures -----------------------------------------------------------

function buildMembership(role: Role = 'owner'): Membership {
  return {
    id: 'mem-1',
    role,
    joined_at: '2026-01-01T00:00:00Z',
    organization: { id: 'org-1', slug: 'acme', name: 'Acme Brasil' },
  };
}

const organization: Organization = {
  id: 'org-1',
  slug: 'acme',
  name: 'Acme Brasil',
  settings: null,
  your_role: 'owner',
  created_at: '2026-01-15T12:00:00Z',
  updated_at: '2026-01-15T12:00:00Z',
};

/** Estado feliz padrão; cada teste sobrescreve o que precisa. */
function resetStates(role: Role = 'owner') {
  const membership = buildMembership(role);
  meState = {
    isPending: false,
    data: {
      user: { id: 'u-1', name: 'Ana Silva', email: 'ana@example.com' },
      memberships: [membership],
    },
  };
  currentOrgState = {
    orgId: 'org-1',
    membership,
    organization,
    role,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  membersState = {
    data: { meta: { total: 42 }, data: [] },
    isError: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  };
  invitationsState = {
    data: { meta: { total: 7 }, data: [] },
    isError: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  resetStates();
  openModalMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests --------------------------------------------------------------

describe('DashboardView — loading', () => {
  it('renders the skeleton while me is pending', () => {
    meState = { isPending: true };

    render(<DashboardView />);

    expect(screen.getByRole('status')).toHaveTextContent(
      t.shell.loading.title,
    );
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('renders the skeleton while the active org is still loading', () => {
    currentOrgState = { ...currentOrgState, organization: null, isLoading: true };

    render(<DashboardView />);

    expect(screen.getByRole('status')).toHaveTextContent(
      t.shell.loading.title,
    );
  });
});

describe('DashboardView — sem org', () => {
  it('renders nothing when the user has no memberships (Shell owns the empty state)', () => {
    meState = {
      isPending: false,
      data: {
        user: { id: 'u-1', name: 'Ana Silva', email: 'ana@example.com' },
        memberships: [],
      },
    };

    const { container } = render(<DashboardView />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the no-active-org panel with a create CTA when nothing resolved', async () => {
    const user = userEvent.setup();
    currentOrgState = {
      ...currentOrgState,
      orgId: null,
      membership: null,
      organization: null,
      role: null,
    };

    render(<DashboardView />);

    expect(
      screen.getByText(t.dashboard.states.noActiveOrgTitle),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: t.dashboard.states.noActiveOrgCta }),
    );
    expect(openModalMock).toHaveBeenCalledWith({ kind: 'create-org' });
  });
});

describe('DashboardView — stat cards', () => {
  it('shows members and pending-invite counts from meta.total', () => {
    render(<DashboardView />);

    const membersCard = screen
      .getByText(t.dashboard.stats.members)
      .closest('a');
    expect(membersCard).toHaveTextContent('42');
    expect(membersCard).toHaveAttribute('href', '/org/acme/settings/members');

    const invitesCard = screen
      .getByText(t.dashboard.stats.pendingInvites)
      .closest('a');
    expect(invitesCard).toHaveTextContent('7');
  });

  it('shows the viewer role and the org creation date as static cards', () => {
    render(<DashboardView />);

    expect(screen.getByText(t.orgs.roleFull.owner)).toBeInTheDocument();
    // created_at 2026-01-15 formatado em pt-BR (dateStyle long).
    expect(screen.getByText(/15 de janeiro de 2026/)).toBeInTheDocument();
    // Cards estáticos não são links.
    expect(
      screen.getByText(t.dashboard.stats.role).closest('a'),
    ).toBeNull();
  });

  it('renders a contextual retry button when the members count fails', async () => {
    const user = userEvent.setup();
    membersState = {
      data: undefined,
      isError: true,
      refetch: vi.fn().mockResolvedValue(undefined),
    };

    render(<DashboardView />);

    const retry = screen.getByRole('button', {
      name: t.dashboard.stats.retry(t.dashboard.stats.members),
    });
    await user.click(retry);

    expect(membersState.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardView — ações rápidas (role gating)', () => {
  it.each<Role>(['owner', 'admin'])(
    'shows the invite quick action for %s linking to the members page',
    (role) => {
      resetStates(role);

      render(<DashboardView />);

      const invite = screen
        .getByText(t.dashboard.actions.inviteTitle)
        .closest('a');
      expect(invite).toHaveAttribute('href', '/org/acme/settings/members');
    },
  );

  it('hides the invite quick action for a plain member', () => {
    resetStates('member');

    render(<DashboardView />);

    expect(
      screen.queryByText(t.dashboard.actions.inviteTitle),
    ).not.toBeInTheDocument();
    // As demais ações continuam visíveis.
    expect(
      screen.getByText(t.dashboard.actions.settingsTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.dashboard.actions.createOrgTitle),
    ).toBeInTheDocument();
  });

  it('opens the create-org modal from the quick action', async () => {
    const user = userEvent.setup();
    render(<DashboardView />);

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(t.dashboard.actions.createOrgTitle),
      }),
    );

    expect(openModalMock).toHaveBeenCalledWith({ kind: 'create-org' });
  });
});

describe('DashboardView — erro da org', () => {
  it('keeps the greeting and shows a retry banner when the org failed to load', async () => {
    const user = userEvent.setup();
    currentOrgState = {
      ...currentOrgState,
      organization: null,
      isError: true,
      refetch: vi.fn(),
    };

    render(<DashboardView />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(t.dashboard.states.orgErrorBody);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    await user.click(
      within(banner).getByRole('button', {
        name: t.dashboard.states.orgErrorRetry,
      }),
    );
    expect(currentOrgState.refetch).toHaveBeenCalled();
    expect(membersState.refetch).toHaveBeenCalled();
    expect(invitationsState.refetch).toHaveBeenCalled();
  });
});

describe('DashboardView — saudação', () => {
  function renderAt(isoLocalTime: string) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(isoLocalTime));
    return render(<DashboardView />);
  }

  it('greets "Bom dia" with the first name at 11:59', () => {
    renderAt('2026-06-11T11:59:00');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Bom dia, Ana' }),
    ).toBeInTheDocument();
  });

  it('switches to "Boa tarde" at exactly 12:00', () => {
    renderAt('2026-06-11T12:00:00');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Boa tarde, Ana' }),
    ).toBeInTheDocument();
  });

  it('greets without a name when the profile name is null', () => {
    meState.data = {
      ...meState.data!,
      user: { id: 'u-1', name: null, email: 'ana@example.com' },
    };
    renderAt('2026-06-11T20:00:00');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Boa noite' }),
    ).toBeInTheDocument();
  });
});
