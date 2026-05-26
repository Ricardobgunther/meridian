import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogoutButton } from './LogoutButton';

const signOutMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

beforeEach(() => {
  signOutMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LogoutButton', () => {
  it('renders the default label', () => {
    render(<LogoutButton />);

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('calls supabase.auth.signOut when clicked', async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows "Saindo…" and disables the button while signing out', async () => {
    const user = userEvent.setup();
    let resolveSignOut: (value: { error: null }) => void = () => undefined;
    signOutMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    render(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    const loadingButton = await screen.findByRole('button', { name: 'Saindo…' });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');

    resolveSignOut({ error: null });
  });

  it('navigates to /login and refreshes after a successful sign out', async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('does not redirect and invokes onError when signOut fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    signOutMock.mockResolvedValueOnce({ error: { message: 'nope' } });

    render(<LogoutButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Não conseguimos sair. Tente novamente.');
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sair' })).not.toBeDisabled();
  });

  it('invokes onError when signOut throws', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    signOutMock.mockRejectedValueOnce(new Error('network'));

    render(<LogoutButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Não conseguimos sair. Tente novamente.');
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
