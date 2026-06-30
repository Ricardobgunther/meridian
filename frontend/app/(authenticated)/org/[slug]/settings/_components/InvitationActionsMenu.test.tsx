import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { InvitationActionsMenu } from './InvitationActionsMenu';
import { t } from '@/lib/i18n/t';
import type { ActiveModal } from '@/lib/stores/ui-store';
import type { Invitation } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

let activeModal: ActiveModal = null;
const openModalMock = vi.fn((m: NonNullable<ActiveModal>) => {
  activeModal = m;
});
const closeModalMock = vi.fn(() => {
  activeModal = null;
});

vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (
    selector: (s: {
      activeModal: ActiveModal;
      openModal: typeof openModalMock;
      closeModal: typeof closeModalMock;
    }) => unknown,
  ) =>
    selector({
      activeModal,
      openModal: openModalMock,
      closeModal: closeModalMock,
    }),
}));

const resendMutateAsync: Mock = vi.fn();
let resendIsPending = false;
vi.mock('@/hooks/use-resend-invitation', () => ({
  useResendInvitation: () => ({
    mutateAsync: resendMutateAsync,
    isPending: resendIsPending,
  }),
}));

const revokeMutateAsync: Mock = vi.fn();
let revokeIsPending = false;
vi.mock('@/hooks/use-revoke-invitation', () => ({
  useRevokeInvitation: () => ({
    mutateAsync: revokeMutateAsync,
    isPending: revokeIsPending,
  }),
}));

// --- Fixtures -----------------------------------------------------------

function makeInvitation(): Invitation {
  return {
    id: 'inv-1',
    organization_id: 'org-1',
    email: 'bruno@acme.com',
    role: 'member',
    status: 'pending',
    expires_at: '2099-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    accepted_at: null,
    revoked_at: null,
    resent_at: null,
    invited_by: null,
  };
}

function renderMenu() {
  return render(
    <InvitationActionsMenu orgId="org-1" invitation={makeInvitation()} />,
  );
}

beforeEach(() => {
  activeModal = null;
  openModalMock.mockClear();
  closeModalMock.mockClear();
  resendMutateAsync.mockReset();
  revokeMutateAsync.mockReset();
  resendIsPending = false;
  revokeIsPending = false;
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests --------------------------------------------------------------

describe('InvitationActionsMenu — trigger', () => {
  it('exposes an aria-label that includes the invitee email', () => {
    renderMenu();
    expect(
      screen.getByRole('button', {
        name: t.invitations.list.actionsMenu('bruno@acme.com'),
      }),
    ).toBeInTheDocument();
  });

  it('opens a menu with Resend and Revoke items', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole('button', {
        name: t.invitations.list.actionsMenu('bruno@acme.com'),
      }),
    );

    expect(
      await screen.findByRole('menuitem', {
        name: t.invitations.list.actionResend,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', {
        name: t.invitations.list.actionRevoke,
      }),
    ).toBeInTheDocument();
  });
});

describe('InvitationActionsMenu — resend action', () => {
  it('calls the resend hook when "Reenviar" is selected', async () => {
    resendMutateAsync.mockResolvedValueOnce({ id: 'inv-1' });
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole('button', {
        name: t.invitations.list.actionsMenu('bruno@acme.com'),
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', {
        name: t.invitations.list.actionResend,
      }),
    );

    await waitFor(() => {
      expect(resendMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('disables the trigger and marks it busy while resending', () => {
    resendIsPending = true;
    renderMenu();

    const trigger = screen.getByRole('button', {
      name: t.invitations.list.actionsMenu('bruno@acme.com'),
    });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-busy', 'true');
  });
});

describe('InvitationActionsMenu — revoke action', () => {
  it('opens the confirmation dialog (no immediate mutation)', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole('button', {
        name: t.invitations.list.actionsMenu('bruno@acme.com'),
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', {
        name: t.invitations.list.actionRevoke,
      }),
    );

    expect(openModalMock).toHaveBeenCalledWith({
      kind: 'confirm-revoke-invitation',
      invitationId: 'inv-1',
      invitationEmail: 'bruno@acme.com',
    });
    expect(revokeMutateAsync).not.toHaveBeenCalled();
  });

  it('renders the ConfirmDialog when the active modal matches this invitation', async () => {
    activeModal = {
      kind: 'confirm-revoke-invitation',
      invitationId: 'inv-1',
      invitationEmail: 'bruno@acme.com',
    };

    renderMenu();

    expect(
      await screen.findByText(t.invitations.list.confirmRevokeTitle),
    ).toBeInTheDocument();
    // Body includes the email.
    expect(
      screen.getByText(t.invitations.list.confirmRevokeBody('bruno@acme.com')),
    ).toBeInTheDocument();
  });

  it('does NOT render the ConfirmDialog when the active modal is for another invitation', () => {
    activeModal = {
      kind: 'confirm-revoke-invitation',
      invitationId: 'OTHER-INV',
      invitationEmail: 'other@acme.com',
    };

    renderMenu();
    expect(
      screen.queryByText(t.invitations.list.confirmRevokeTitle),
    ).not.toBeInTheDocument();
  });

  it('confirms revoke: calls the revoke hook then closes the modal on success', async () => {
    activeModal = {
      kind: 'confirm-revoke-invitation',
      invitationId: 'inv-1',
      invitationEmail: 'bruno@acme.com',
    };
    revokeMutateAsync.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderMenu();

    const confirm = await screen.findByRole('button', {
      name: t.invitations.list.confirmRevokeCta,
    });
    await user.click(confirm);

    await waitFor(() => {
      expect(revokeMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(closeModalMock).toHaveBeenCalled();
  });

  it('keeps the ConfirmDialog open if the revoke mutation rejects', async () => {
    activeModal = {
      kind: 'confirm-revoke-invitation',
      invitationId: 'inv-1',
      invitationEmail: 'bruno@acme.com',
    };
    revokeMutateAsync.mockRejectedValueOnce(new Error('boom'));

    const user = userEvent.setup();
    renderMenu();

    await user.click(
      await screen.findByRole('button', {
        name: t.invitations.list.confirmRevokeCta,
      }),
    );

    await waitFor(() => {
      expect(revokeMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(closeModalMock).not.toHaveBeenCalled();
  });

  it('shows the "Revogando..." label and aria-busy while the mutation runs', async () => {
    activeModal = {
      kind: 'confirm-revoke-invitation',
      invitationId: 'inv-1',
      invitationEmail: 'bruno@acme.com',
    };
    revokeIsPending = true;
    renderMenu();

    const confirm = await screen.findByRole('button', {
      name: t.invitations.list.revoking,
    });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
  });
});
