import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { InvitePageView, type InitialState } from './InvitePageView';
import { t } from '@/lib/i18n/t';
import type { AcceptPreviewPending } from '@/lib/types/api';

// AcceptForm is exercised in its own test — replace with a sentinel that
// also exposes the onStateChange so we can drive overrides in tests.
let exposedStateSetter:
  | ((next: 'expired' | 'revoked' | 'wrong-email' | 'invalid') => void)
  | null = null;
vi.mock('./AcceptForm', () => ({
  AcceptForm: ({
    onStateChange,
  }: {
    token: string;
    onStateChange: (next: 'expired' | 'revoked' | 'wrong-email' | 'invalid') => void;
  }) => {
    exposedStateSetter = onStateChange;
    return <div data-testid="accept-form" />;
  },
}));

// SignOutButton calls supabase — replace with a noop sentinel.
vi.mock('./SignOutButton', () => ({
  SignOutButton: ({ token }: { token: string }) => (
    <button data-testid="signout-btn" data-token={token}>
      Sair
    </button>
  ),
}));

// Mutations used inside cards we're not exercising directly — stubbed to be safe.
const stubMutation = { mutateAsync: vi.fn() as Mock, isPending: false };
vi.mock('@/hooks/use-accept-invitation', () => ({
  useAcceptInvitation: () => stubMutation,
}));
vi.mock('@/hooks/use-decline-invitation', () => ({
  useDeclineInvitation: () => stubMutation,
}));

// Helpers --------------------------------------------------------------

function makePreview(
  overrides: Partial<AcceptPreviewPending> = {},
): AcceptPreviewPending {
  return {
    status: 'pending',
    email: 'bruno@acme.com',
    role: 'admin',
    expires_at: '2099-01-01T00:00:00.000Z',
    organization: { id: 'org-1', slug: 'acme', name: 'Acme Brasil' },
    invited_by: { name: 'Ada' },
    ...overrides,
  };
}

beforeEach(() => {
  exposedStateSetter = null;
  stubMutation.mutateAsync.mockReset();
});

// Tests ----------------------------------------------------------------

describe('InvitePageView — initial state routing', () => {
  it('renders the authenticated ready card and forwards a working AcceptForm', () => {
    const initial: InitialState = {
      kind: 'ready-authed',
      preview: makePreview(),
    };
    render(
      <InvitePageView
        token="tok-1"
        initial={initial}
        sessionEmail="bruno@acme.com"
      />,
    );

    expect(screen.getByText('Acme Brasil')).toBeInTheDocument();
    expect(screen.getByTestId('accept-form')).toBeInTheDocument();
    // The email appears in the body label.
    expect(
      screen.getByText(t.invitations.accept.readyEmailLabel('bruno@acme.com')),
    ).toBeInTheDocument();
  });

  it('renders the anonymous ready card with a login-with-invite link', () => {
    const initial: InitialState = {
      kind: 'ready-anon',
      preview: makePreview(),
    };
    render(
      <InvitePageView
        token="tok-anon"
        initial={initial}
        sessionEmail={null}
      />,
    );

    const cta = screen.getByRole('link', {
      name: t.invitations.accept.anonCta,
    });
    expect(cta).toHaveAttribute('href', '/login?invite=tok-anon');
  });

  it('renders the expired hard-stop card', () => {
    render(
      <InvitePageView
        token="t"
        initial={{ kind: 'expired' }}
        sessionEmail={null}
      />,
    );

    expect(
      screen.getByText(t.invitations.accept.expiredTitle),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the revoked hard-stop card', () => {
    render(
      <InvitePageView
        token="t"
        initial={{ kind: 'revoked' }}
        sessionEmail={null}
      />,
    );

    expect(
      screen.getByText(t.invitations.accept.revokedTitle),
    ).toBeInTheDocument();
  });

  it('renders the invalid hard-stop card', () => {
    render(
      <InvitePageView
        token="t"
        initial={{ kind: 'invalid' }}
        sessionEmail={null}
      />,
    );

    expect(
      screen.getByText(t.invitations.accept.invalidTitle),
    ).toBeInTheDocument();
  });

  it('renders the wrong-email card when initial=wrong-email', () => {
    const initial: InitialState = {
      kind: 'wrong-email',
      preview: makePreview(),
      connectedEmail: 'bruno-pessoal@gmail.com',
    };
    render(
      <InvitePageView
        token="tok-1"
        initial={initial}
        sessionEmail="bruno-pessoal@gmail.com"
      />,
    );

    expect(
      screen.getByText(t.invitations.accept.wrongEmailTitle),
    ).toBeInTheDocument();
    // Connected email appears, expected email appears.
    expect(screen.getByText('bruno-pessoal@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('bruno@acme.com')).toBeInTheDocument();
    expect(screen.getByTestId('signout-btn')).toBeInTheDocument();
  });
});

describe('InvitePageView — runtime state overrides', () => {
  it('swaps to the expired card when AcceptForm signals "expired"', async () => {
    render(
      <InvitePageView
        token="tok-1"
        initial={{ kind: 'ready-authed', preview: makePreview() }}
        sessionEmail="bruno@acme.com"
      />,
    );

    // Trigger the override via the captured setter.
    expect(exposedStateSetter).not.toBeNull();
    exposedStateSetter!('expired');

    // The view re-renders with the hard-stop card.
    expect(
      await screen.findByText(t.invitations.accept.expiredTitle),
    ).toBeInTheDocument();
  });

  it('swaps to the revoked card when AcceptForm signals "revoked"', async () => {
    render(
      <InvitePageView
        token="tok-1"
        initial={{ kind: 'ready-authed', preview: makePreview() }}
        sessionEmail="bruno@acme.com"
      />,
    );

    exposedStateSetter!('revoked');

    expect(
      await screen.findByText(t.invitations.accept.revokedTitle),
    ).toBeInTheDocument();
  });

  it('swaps to the wrong-email card when AcceptForm signals "wrong-email"', async () => {
    render(
      <InvitePageView
        token="tok-1"
        initial={{
          kind: 'ready-authed',
          preview: makePreview({ email: 'bruno@acme.com' }),
        }}
        sessionEmail="bruno-pessoal@gmail.com"
      />,
    );

    exposedStateSetter!('wrong-email');

    expect(
      await screen.findByText(t.invitations.accept.wrongEmailTitle),
    ).toBeInTheDocument();
  });
});

describe('InvitePageView — accessibility hooks', () => {
  it("uses role='alert' for terminal states", () => {
    render(
      <InvitePageView
        token="t"
        initial={{ kind: 'expired' }}
        sessionEmail={null}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // Anonymous trigger button to login is not optional even if the user clicks it.
  it('preserves the token via encodeURIComponent in the anon CTA href', async () => {
    const initial: InitialState = {
      kind: 'ready-anon',
      preview: makePreview(),
    };
    render(
      <InvitePageView
        token="abc/def?weird=value"
        initial={initial}
        sessionEmail={null}
      />,
    );

    const link = screen.getByRole('link', { name: t.invitations.accept.anonCta });
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('abc/def?weird=value'),
    );
    await userEvent.setup().click(link); // ensure click doesn't throw
  });
});
