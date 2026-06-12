import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { LeaveOrgSection } from './LeaveOrgSection';
import { t } from '@/lib/i18n/t';
import type { ApiError, Organization, Role } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const setCurrentOrgIdMock = vi.fn();
vi.mock('@/lib/org/current', () => ({
  setCurrentOrgId: (...a: unknown[]) => setCurrentOrgIdMock(...a),
}));

const announceMock = vi.fn();
vi.mock('@/lib/a11y/announce', () => ({
  announce: (...a: unknown[]) => announceMock(...a),
}));

const mutateAsyncMock: Mock = vi.fn();
vi.mock('@/hooks/use-leave-org', () => ({
  useLeaveOrg: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

// --- Helpers ------------------------------------------------------------

const org: Organization = {
  id: 'org-1',
  slug: 'acme-brasil',
  name: 'Acme Brasil',
  settings: null,
  your_role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

let invalidateSpy: Mock;

function renderSection(role: Role = 'member') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  invalidateSpy = vi.fn();
  queryClient.invalidateQueries = invalidateSpy;
  return render(
    <QueryClientProvider client={queryClient}>
      <LeaveOrgSection organization={org} role={role} />
    </QueryClientProvider>,
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: t.settings.leaveOrg.cta }),
  );
  return screen.findByRole('dialog');
}

function buildApiError(overrides: Partial<ApiError>): ApiError {
  return {
    status: overrides.status ?? 422,
    code: overrides.code ?? 'validation',
    message: overrides.message ?? 'Erro',
    fieldErrors: overrides.fieldErrors,
    raw: overrides.raw,
  };
}

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  setCurrentOrgIdMock.mockReset();
  announceMock.mockReset();
  mutateAsyncMock.mockReset();
});

// --- Tests --------------------------------------------------------------

describe('LeaveOrgSection — card', () => {
  it('renders the card with title, org-specific body and CTA', () => {
    renderSection('member');

    expect(
      screen.getByRole('heading', { name: t.settings.leaveOrg.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.settings.leaveOrg.body('Acme Brasil')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.settings.leaveOrg.cta }),
    ).toBeEnabled();
  });

  it('shows the lone-owner hint only for owners', () => {
    const { unmount } = renderSection('owner');
    expect(
      screen.getByText(t.settings.leaveOrg.ownerHint),
    ).toBeInTheDocument();
    unmount();

    renderSection('member');
    expect(
      screen.queryByText(t.settings.leaveOrg.ownerHint),
    ).not.toBeInTheDocument();
  });

  it('opens the confirm dialog naming the org when the CTA is clicked', async () => {
    const user = userEvent.setup();
    renderSection('member');

    const dialog = await openDialog(user);

    expect(
      within(dialog).getByText(
        t.settings.leaveOrg.confirmTitle('Acme Brasil'),
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(t.settings.leaveOrg.confirmBody),
    ).toBeInTheDocument();
    // Nenhum POST antes da confirmação.
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});

describe('LeaveOrgSection — sucesso (204)', () => {
  it('clears the active org, wipes the cache and redirects to /dashboard', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    renderSection('member');

    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(setCurrentOrgIdMock).toHaveBeenCalledWith(null);
    expect(invalidateSpy).toHaveBeenCalledWith(); // wipe total, sem keys
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('closes the dialog, toasts and announces the exit politely', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    renderSection('member');

    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      t.settings.leaveOrg.successToast,
      expect.objectContaining({
        description: t.settings.leaveOrg.successToastBody('Acme Brasil'),
      }),
    );
    expect(announceMock).toHaveBeenCalledWith(
      t.settings.leaveOrg.announcement('Acme Brasil'),
    );
  });
});

describe('LeaveOrgSection — 422 lone_owner', () => {
  it('shows the dictionary message in a role=alert inside the OPEN dialog', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 422,
        code: 'validation',
        message: 'Não é possível remover o último proprietário.',
        raw: {
          error: 'Não é possível remover o último proprietário.',
          code: 'lone_owner',
        },
      }),
    );
    renderSection('owner');

    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );

    // Alerta inline com a copy do dicionário (vence a mensagem do backend).
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(t.settings.leaveOrg.errors.loneOwner);

    // Diálogo segue aberto; nenhuma limpeza de tenant aconteceu.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(setCurrentOrgIdMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('clears the inline alert when the dialog is closed and reopened', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 422,
        raw: { error: 'msg', code: 'lone_owner' },
      }),
    );
    renderSection('owner');

    let dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );
    await within(dialog).findByRole('alert');

    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.cancel,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    dialog = await openDialog(user);
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LeaveOrgSection — 403/404 (membership sumiu)', () => {
  it('runs the cleanup-anyway path on 403: toast error + clear org + redirect', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({
        status: 403,
        code: 'forbidden',
        message: 'Você não tem permissão para esta ação.',
      }),
    );
    renderSection('member');

    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(toastError).toHaveBeenCalled();
    expect(setCurrentOrgIdMock).toHaveBeenCalledWith(null);
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });
});

describe('LeaveOrgSection — erro de rede/5xx', () => {
  it('keeps the dialog open with the parseApiError message inline', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(
      buildApiError({ status: 500, code: 'server', message: 'boom' }),
    );
    renderSection('member');

    const dialog = await openDialog(user);
    await user.click(
      within(dialog).getByRole('button', {
        name: t.settings.leaveOrg.confirm,
      }),
    );

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('boom');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(setCurrentOrgIdMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
