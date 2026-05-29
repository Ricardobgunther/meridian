import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AcceptForm } from './AcceptForm';
import { t } from '@/lib/i18n/t';
import type { ApiError } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

const acceptMutateAsync: Mock = vi.fn();
let acceptIsPending = false;
vi.mock('@/hooks/use-accept-invitation', () => ({
  useAcceptInvitation: () => ({
    mutateAsync: acceptMutateAsync,
    isPending: acceptIsPending,
  }),
}));

const declineMutateAsync: Mock = vi.fn();
let declineIsPending = false;
vi.mock('@/hooks/use-decline-invitation', () => ({
  useDeclineInvitation: () => ({
    mutateAsync: declineMutateAsync,
    isPending: declineIsPending,
  }),
}));

// --- Helpers ------------------------------------------------------------

function buildApiError(overrides: Partial<ApiError>): ApiError {
  return {
    status: overrides.status ?? 400,
    code: overrides.code ?? 'unknown',
    message: overrides.message ?? 'erro',
    fieldErrors: overrides.fieldErrors,
    raw: overrides.raw,
  };
}

function renderForm(onStateChange = vi.fn()) {
  return {
    onStateChange,
    ...render(<AcceptForm token="tok-1" onStateChange={onStateChange} />),
  };
}

beforeEach(() => {
  acceptMutateAsync.mockReset();
  declineMutateAsync.mockReset();
  acceptIsPending = false;
  declineIsPending = false;
});

// --- Tests --------------------------------------------------------------

describe('AcceptForm — happy paths', () => {
  it('calls the accept mutation when "Aceitar" is clicked', async () => {
    acceptMutateAsync.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    await waitFor(() => {
      expect(acceptMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('calls the decline mutation when "Recusar" is clicked', async () => {
    declineMutateAsync.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.decline }),
    );

    await waitFor(() => {
      expect(declineMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the accepting label and aria-busy while accepting', () => {
    acceptIsPending = true;
    renderForm();

    const btn = screen.getByRole('button', {
      name: t.invitations.accept.accepting,
    });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('disables both CTAs while either mutation is pending', () => {
    declineIsPending = true;
    renderForm();

    expect(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: t.invitations.accept.declining }),
    ).toBeDisabled();
  });
});

describe('AcceptForm — error→state transitions', () => {
  it('switches to "expired" when accept rejects with 410 + invitation_expired', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({
        status: 410,
        code: 'unknown',
        message: 'gone',
        raw: { code: 'invitation_expired' },
      }),
    );
    const onStateChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onStateChange);

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('expired');
    });
  });

  it('switches to "revoked" when accept rejects with 410 + invitation_revoked', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({
        status: 410,
        code: 'unknown',
        message: 'gone',
        raw: { code: 'invitation_revoked' },
      }),
    );
    const onStateChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onStateChange);

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('revoked');
    });
  });

  it('switches to "expired" on 404 (treated as terminal)', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({ status: 404, code: 'not_found', message: 'not found' }),
    );
    const onStateChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onStateChange);

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('expired');
    });
  });

  it('switches to "wrong-email" when domain code is invitation_email_mismatch', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({
        status: 422,
        code: 'validation',
        message: 'wrong email',
        raw: { code: 'invitation_email_mismatch' },
      }),
    );
    const onStateChange = vi.fn();
    const user = userEvent.setup();
    renderForm(onStateChange);

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('wrong-email');
    });
  });

  it('renders the "already used" inline alert on 409', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({ status: 409, code: 'unknown', message: 'already' }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    expect(
      await screen.findByText(t.invitations.accept.inlineErrorAlreadyUsed),
    ).toBeInTheDocument();
  });

  it('renders a generic inline error for an unmapped server error', async () => {
    acceptMutateAsync.mockRejectedValueOnce(
      buildApiError({ status: 500, code: 'server', message: 'oops' }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.accept }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.invitations.accept.inlineErrorTitle);
  });

  it('shows an inline error on decline failure', async () => {
    declineMutateAsync.mockRejectedValueOnce(
      buildApiError({ status: 500, code: 'server', message: 'down' }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.accept.decline }),
    );

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(t.invitations.accept.inlineErrorTitle);
  });
});
