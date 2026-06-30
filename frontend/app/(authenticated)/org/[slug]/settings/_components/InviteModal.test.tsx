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

import { InviteModal } from './InviteModal';
import { t } from '@/lib/i18n/t';
import type { ApiError } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

const closeModalMock = vi.fn();
vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (
    selector: (s: {
      activeModal: { kind: 'invite-member' };
      closeModal: typeof closeModalMock;
    }) => unknown,
  ) =>
    selector({
      activeModal: { kind: 'invite-member' },
      closeModal: closeModalMock,
    }),
}));

const mutateAsyncMock: Mock = vi.fn();
let isPending = false;
vi.mock('@/hooks/use-create-invitation', () => ({
  useCreateInvitation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
  },
}));

// --- Helpers ------------------------------------------------------------

function buildApiError(overrides: Partial<ApiError> & { code?: ApiError['code'] }): ApiError {
  return {
    status: overrides.status ?? 400,
    code: overrides.code ?? 'unknown',
    message: overrides.message ?? 'Erro genérico',
    fieldErrors: overrides.fieldErrors,
    raw: overrides.raw,
  };
}

function renderModal() {
  return render(<InviteModal orgId="org-1" />);
}

beforeEach(() => {
  closeModalMock.mockReset();
  mutateAsyncMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  isPending = false;
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests --------------------------------------------------------------

describe('InviteModal — client-side validation', () => {
  it('blocks submit when email is empty and shows the required error after blur', async () => {
    const user = userEvent.setup();
    renderModal();

    const submit = await screen.findByRole('button', {
      name: t.invitations.modal.submit,
    });
    expect(submit).toBeDisabled();

    // Trigger blur without typing anything.
    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.click(input);
    await user.tab();

    expect(
      await screen.findByText(t.invitations.modal.errors.emailRequired),
    ).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('shows "Email inválido" for a malformed address', async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.type(input, 'not-an-email');
    await user.tab();

    expect(
      await screen.findByText(t.invitations.modal.errors.emailInvalid),
    ).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('clears the inline error when the user edits a valid email after blur', async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.type(input, 'bad');
    await user.tab();
    expect(
      await screen.findByText(t.invitations.modal.errors.emailInvalid),
    ).toBeInTheDocument();

    // Now fix the email — the touched flag is set, so onChange re-validates.
    await user.clear(input);
    await user.type(input, 'ok@acme.com');

    await waitFor(() =>
      expect(
        screen.queryByText(t.invitations.modal.errors.emailInvalid),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('InviteModal — happy path', () => {
  it('submits a valid payload, fires success toast, and closes the modal', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inv-1' });
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.type(input, 'bruno@acme.com');

    const submit = screen.getByRole('button', {
      name: t.invitations.modal.submit,
    });
    await user.click(submit);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        email: 'bruno@acme.com',
        role: 'member',
      });
    });

    expect(toastSuccess).toHaveBeenCalled();
    expect(closeModalMock).toHaveBeenCalled();
  });

  it('trims whitespace around the email before submitting', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ id: 'inv-1' });
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.type(input, '   bruno@acme.com   ');
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        email: 'bruno@acme.com',
        role: 'member',
      });
    });
  });
});

describe('InviteModal — server error mapping', () => {
  it('maps invitation_already_member to an inline field error', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 409,
        code: 'unknown',
        message: 'já é membro',
        raw: { code: 'invitation_already_member' },
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    expect(
      await screen.findByText(t.invitations.modal.errors.emailAlreadyMember),
    ).toBeInTheDocument();
    expect(closeModalMock).not.toHaveBeenCalled();
  });

  it('maps invitation_already_pending to an inline field error', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 409,
        code: 'unknown',
        message: 'pendente',
        raw: { code: 'invitation_already_pending' },
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    expect(
      await screen.findByText(t.invitations.modal.errors.emailAlreadyPending),
    ).toBeInTheDocument();
  });

  it('shows a rate-limited toast on 429 without closing the modal', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({ status: 429, code: 'rate_limited', message: 'slow down' }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        t.invitations.modal.errors.rateLimitedTitle,
        expect.objectContaining({
          description: t.invitations.modal.errors.rateLimitedBody,
        }),
      );
    });
    expect(closeModalMock).not.toHaveBeenCalled();
  });

  it('shows a forbidden toast and closes the modal on 403', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({ status: 403, code: 'forbidden', message: 'nope' }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        t.invitations.modal.errors.forbidden,
      );
    });
    expect(closeModalMock).toHaveBeenCalled();
  });

  it('maps 422 fieldErrors.email to the inline error', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 422,
        code: 'validation',
        message: 'check fields',
        fieldErrors: { email: ['O campo email é inválido.'] },
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    expect(
      await screen.findByText('O campo email é inválido.'),
    ).toBeInTheDocument();
  });

  it('falls back to a generic toast for unmapped errors', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({ status: 500, code: 'server', message: 'oops' }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByLabelText(t.invitations.modal.emailLabel),
      'bruno@acme.com',
    );
    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        t.invitations.modal.errors.generic,
        expect.any(Object),
      );
    });
    expect(closeModalMock).not.toHaveBeenCalled();
  });
});
