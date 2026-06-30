import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { ReactNode } from 'react';

import { useCheckSlug } from './use-check-slug';
import { useCreateOrg } from './use-create-org';
import type { ApiError } from '@/lib/types/api';

// --- Mocks --------------------------------------------------------------

const apiFetchMock: Mock = vi.fn();
vi.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetchMock(...a),
}));

// Dependências do useCreateOrg (usado no teste de 422-overwrite).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Helpers ------------------------------------------------------------

function available(slug: string) {
  return { data: { slug, available: true } };
}

function taken(slug: string) {
  return { data: { slug, available: false } };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }
  return { queryClient, wrapper: Wrapper };
}

/** Avança timers (debounce) e deixa promessas da query assentarem. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  apiFetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests --------------------------------------------------------------

describe('useCheckSlug — gate de validade', () => {
  it('stays idle and never fetches for an empty slug', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug(''), { wrapper });

    await advance(500);

    expect(result.current.status).toBe('idle');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('stays idle and never fetches for a slug shorter than 3 chars', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug('ab'), { wrapper });

    await advance(500);

    expect(result.current.status).toBe('idle');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('stays idle and never fetches for a malformed slug', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug('Acme Brasil!!'), {
      wrapper,
    });

    await advance(500);

    expect(result.current.status).toBe('idle');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe('useCheckSlug — debounce', () => {
  it('coalesces rapid keystrokes into a single request for the final slug', async () => {
    apiFetchMock.mockResolvedValue(available('acme'));
    const { wrapper } = createWrapper();
    const { rerender } = renderHook(({ slug }) => useCheckSlug(slug), {
      wrapper,
      initialProps: { slug: '' },
    });

    // Digitação rápida: cada tecla chega antes da janela de 400ms fechar.
    rerender({ slug: 'a' });
    await advance(100);
    rerender({ slug: 'acm' });
    await advance(100);
    rerender({ slug: 'acme' });
    await advance(400);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/organizations/check-slug',
      expect.objectContaining({
        query: { slug: 'acme' },
        skipOrgHeader: true,
      }),
    );
  });

  it('reports checking (not a stale verdict) while the debounce is pending', async () => {
    apiFetchMock.mockResolvedValue(available('acme'));
    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      ({ slug }) => useCheckSlug(slug),
      { wrapper, initialProps: { slug: 'acme' } },
    );

    await advance(400);
    expect(result.current.status).toBe('available');

    // Nova tecla: o veredito anterior some na hora, sem esperar o debounce.
    rerender({ slug: 'acme-2' });
    expect(result.current.status).toBe('checking');
  });
});

describe('useCheckSlug — vereditos', () => {
  it('returns available when the API says the slug is free', async () => {
    apiFetchMock.mockResolvedValue(available('acme'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug('acme'), { wrapper });

    expect(result.current.status).toBe('checking');
    await advance(400);

    expect(result.current.status).toBe('available');
  });

  it('returns taken when the API says the slug is in use', async () => {
    apiFetchMock.mockResolvedValue(taken('acme'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug('acme'), { wrapper });

    await advance(400);

    expect(result.current.status).toBe('taken');
  });

  it('degrades silently to idle when the check fails (network/5xx)', async () => {
    apiFetchMock.mockRejectedValue(
      Object.assign(new Error('boom'), { status: 500, code: 'server' }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckSlug('acme'), { wrapper });

    await advance(400);

    // Overview J4: falha do advisory nunca alarma nem bloqueia.
    expect(result.current.status).toBe('idle');
  });
});

describe('useCheckSlug — 422-overwrite do create-org', () => {
  it('flips a cached available verdict to taken after POST /organizations 422 on slug', async () => {
    const { wrapper } = createWrapper();

    // 1. Preview diz "disponível".
    apiFetchMock.mockResolvedValueOnce(available('acme'));
    const { result } = renderHook(
      () => ({
        check: useCheckSlug('acme'),
        create: useCreateOrg(),
      }),
      { wrapper },
    );
    await advance(400);
    expect(result.current.check.status).toBe('available');

    // 2. POST autoritativo falha com 422 em slug.
    const err: ApiError = {
      status: 422,
      code: 'validation',
      message: 'Este identificador já está em uso.',
      fieldErrors: { slug: ['Este identificador já está em uso.'] },
      raw: { errors: { slug: ['Este identificador já está em uso.'] } },
    };
    apiFetchMock.mockRejectedValueOnce(err);
    await act(async () => {
      await result.current.create
        .mutateAsync({ name: 'Acme', slug: 'acme' })
        .catch(() => undefined);
    });

    // Flush da notificação do notifyManager (agendada via setTimeout 0).
    await advance(0);

    // 3. O cache do preview foi sobrescrito — sem nova request.
    expect(result.current.check.status).toBe('taken');
    expect(apiFetchMock).toHaveBeenCalledTimes(2); // check + POST, nada mais
  });
});
