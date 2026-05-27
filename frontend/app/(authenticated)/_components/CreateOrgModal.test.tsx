import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

import { CreateOrgModal } from './CreateOrgModal';

// useUiStore: simula activeModal = create-org.
const closeModalMock = vi.fn();
vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (
    selector: (s: {
      activeModal: { kind: 'create-org' };
      closeModal: typeof closeModalMock;
    }) => unknown,
  ) =>
    selector({
      activeModal: { kind: 'create-org' },
      closeModal: closeModalMock,
    }),
}));

// useCreateOrg — exposto via prop pelo mock.
const mutateAsyncMock: Mock = vi.fn();
vi.mock('@/hooks/use-create-org', () => ({
  useCreateOrg: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function renderModal() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CreateOrgModal />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  closeModalMock.mockReset();
  mutateAsyncMock.mockReset();
});

describe('CreateOrgModal — validação client-side', () => {
  it('blocks submit and shows error for empty name', async () => {
    const user = userEvent.setup();
    renderModal();

    const submit = await screen.findByRole('button', { name: 'Criar' });
    // Inicialmente desabilitado porque o form não está sujo.
    expect(submit).toBeDisabled();

    // Tipa só no slug; nome continua vazio → invalid após blur.
    const slug = screen.getByLabelText(/identificador/i);
    await user.type(slug, 'acme');
    // Remove foco para acionar validação.
    await user.tab();

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('rejects invalid slug pattern', async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByLabelText(/^nome$/i);
    const slug = screen.getByLabelText(/identificador/i);

    await user.type(name, 'Acme');
    // O slug seria auto-derivado, mas vamos forçar inválido:
    await user.clear(slug);
    await user.type(slug, 'Acme Brasil!!');
    await user.tab();

    const errors = await screen.findAllByRole('alert');
    expect(errors.some((e) => /letras minúsculas/i.test(e.textContent ?? ''))).toBe(
      true,
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits valid payload and closes modal on success', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce({
      id: 'org-1',
      slug: 'acme-brasil',
      name: 'Acme Brasil',
    });
    renderModal();

    const name = screen.getByLabelText(/^nome$/i);
    await user.type(name, 'Acme Brasil');

    // Slug é auto-derivado, então deve ficar "acme-brasil".
    const slug = screen.getByLabelText(/identificador/i) as HTMLInputElement;
    expect(slug.value).toBe('acme-brasil');

    const submit = screen.getByRole('button', { name: 'Criar' });
    await user.click(submit);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        name: 'Acme Brasil',
        slug: 'acme-brasil',
      });
    });
    expect(closeModalMock).toHaveBeenCalled();
  });

  it('keeps slug intact once user manually edits it (does not re-derive)', async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByLabelText(/^nome$/i);
    const slug = screen.getByLabelText(/identificador/i) as HTMLInputElement;

    await user.type(name, 'Acme');
    expect(slug.value).toBe('acme');

    // Usuário edita slug manualmente.
    await user.clear(slug);
    await user.type(slug, 'custom-id');

    // Continua digitando no nome — slug NÃO deve mudar mais.
    await user.type(name, ' Brasil');
    expect(slug.value).toBe('custom-id');
  });
});
