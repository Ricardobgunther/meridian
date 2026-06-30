import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CreateOrgModal } from './CreateOrgModal';
import { t } from '@/lib/i18n/t';
import type { SlugCheckStatus } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

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

// useCheckSlug controlável: o teste dita o status e captura o slug
// observado pelo hook (deve seguir o VALOR do campo, mesmo auto-derivado).
let slugStatus: SlugCheckStatus = 'idle';
const checkedSlugs: string[] = [];
vi.mock('@/hooks/use-check-slug', () => ({
  useCheckSlug: (slug: string) => {
    checkedSlugs.push(slug);
    return { status: slugStatus };
  },
}));

// --- Helpers ------------------------------------------------------------

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
  slugStatus = 'idle';
  checkedSlugs.length = 0;
});

// --- Tests --------------------------------------------------------------

describe('CreateOrgForm — wiring do SlugAvailability', () => {
  it('observes the slug auto-derived from the name (not only manual edits)', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/^nome$/i), 'Acme Brasil');

    // O hook viu o valor derivado — feedback antes de tocar no campo slug.
    expect(checkedSlugs).toContain('acme-brasil');
  });

  it('renders the taken message in a polite live region', async () => {
    const user = userEvent.setup();
    slugStatus = 'taken';
    renderModal();

    await user.type(screen.getByLabelText(/^nome$/i), 'Acme Brasil');

    const message = screen.getByText(t.orgs.create.errors.slugTaken);
    const liveRegion = message.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('does NOT disable submit when the slug is reported as taken (advisory only)', async () => {
    const user = userEvent.setup();
    slugStatus = 'taken';
    mutateAsyncMock.mockResolvedValueOnce({
      id: 'org-1',
      slug: 'acme-brasil',
      name: 'Acme Brasil',
    });
    renderModal();

    await user.type(screen.getByLabelText(/^nome$/i), 'Acme Brasil');

    // J4: o 422 do POST é a fonte da verdade — o preview nunca bloqueia.
    const submit = screen.getByRole('button', { name: 'Criar' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      name: 'Acme Brasil',
      slug: 'acme-brasil',
    });
  });

  it('shows the checking state while the verdict is pending', async () => {
    const user = userEvent.setup();
    slugStatus = 'checking';
    renderModal();

    await user.type(screen.getByLabelText(/^nome$/i), 'Acme');

    expect(
      screen.getByText(t.orgs.create.slugCheck.checking),
    ).toBeInTheDocument();
  });

  it('shows the available verdict under the slug field', async () => {
    const user = userEvent.setup();
    slugStatus = 'available';
    renderModal();

    await user.type(screen.getByLabelText(/^nome$/i), 'Acme');

    expect(
      screen.getByText(t.orgs.create.slugCheck.available),
    ).toBeInTheDocument();
  });

  it('keeps the field error channel (aria-describedby) separate from the live region', async () => {
    const user = userEvent.setup();
    slugStatus = 'taken';
    renderModal();

    // Slug auto-derivado, sem blur: nenhum erro de validação em jogo.
    await user.type(screen.getByLabelText(/^nome$/i), 'Acme Brasil');
    const slugInput = screen.getByLabelText(/identificador/i);

    // O status advisory NÃO marca o input como inválido nem entra no
    // describedby — o canal de erro pertence à validação/422 (spec 03 §2).
    expect(slugInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(slugInput).toHaveAttribute('aria-describedby', 'org-slug-helper');
    const liveRegion = screen
      .getByText(t.orgs.create.errors.slugTaken)
      .closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // A live region não participa do aria-describedby do input.
    expect(liveRegion?.id ?? '').not.toBe('org-slug-helper');
  });
});
