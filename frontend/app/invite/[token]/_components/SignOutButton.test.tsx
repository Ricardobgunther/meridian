import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignOutButton } from './SignOutButton';

const signOutMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const assignMock = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  signOutMock.mockReset();
  toastErrorMock.mockReset();
  assignMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  // jsdom's location.assign is a non-configurable noop, so swap the whole
  // location for a minimal stub the component can call into.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: assignMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe('SignOutButton', () => {
  it('renders the sign-out label', () => {
    render(<SignOutButton token="tok-123" />);

    expect(
      screen.getByRole('button', { name: 'Sair desta conta' }),
    ).toBeInTheDocument();
  });

  it('navigates to /login preserving the invite token after a successful sign out', async () => {
    const user = userEvent.setup();
    render(<SignOutButton token="tok 123" />);

    await user.click(screen.getByRole('button', { name: 'Sair desta conta' }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
    // Token is URL-encoded so a value with spaces survives the redirect.
    expect(assignMock).toHaveBeenCalledWith('/login?invite=tok%20123');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows "Saindo..." and disables the button while signing out', async () => {
    const user = userEvent.setup();
    let resolveSignOut: (value: { error: null }) => void = () => undefined;
    signOutMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    render(<SignOutButton token="tok-123" />);

    await user.click(screen.getByRole('button', { name: 'Sair desta conta' }));

    const loadingButton = await screen.findByRole('button', { name: 'Saindo...' });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');

    resolveSignOut({ error: null });
  });

  it('shows an error toast and does NOT navigate when signOut returns an error', async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValueOnce({ error: { message: 'boom' } });

    render(<SignOutButton token="tok-123" />);

    await user.click(screen.getByRole('button', { name: 'Sair desta conta' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(assignMock).not.toHaveBeenCalled();
    // Button is re-enabled so the user can retry.
    expect(
      screen.getByRole('button', { name: 'Sair desta conta' }),
    ).not.toBeDisabled();
  });

  it('shows an error toast and does NOT navigate when signOut throws', async () => {
    const user = userEvent.setup();
    signOutMock.mockRejectedValueOnce(new Error('network'));

    render(<SignOutButton token="tok-123" />);

    await user.click(screen.getByRole('button', { name: 'Sair desta conta' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(assignMock).not.toHaveBeenCalled();
    // Same retry affordance as the returned-error branch.
    expect(
      screen.getByRole('button', { name: 'Sair desta conta' }),
    ).not.toBeDisabled();
  });
});
