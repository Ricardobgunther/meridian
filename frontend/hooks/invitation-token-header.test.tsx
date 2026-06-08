import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAcceptInvitation } from './use-accept-invitation';
import { useDeclineInvitation } from './use-decline-invitation';
import { useInvitationPreview } from './use-invitation-preview';

/*
 * R10 contract: the invitation token is a bearer credential and must travel
 * in the X-Invitation-Token header, NEVER in the URL path (where it would
 * land in access logs). These tests pin that for all three API hooks so a
 * future refactor can't silently move the token back into the path.
 */

const apiFetchMock = vi.fn();
vi.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

// accept/decline hooks navigate + announce on success — stub those side deps.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/a11y/announce', () => ({ announce: vi.fn() }));
vi.mock('@/lib/org/current', () => ({ setCurrentOrgId: vi.fn() }));

const TOKEN = 'tok-abc-1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ_-';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('invitation API hooks send the token in the header, not the path (R10)', () => {
  it('useAcceptInvitation POSTs the static path with the X-Invitation-Token header', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: { organization: null } });

    const { result } = renderHook(() => useAcceptInvitation(TOKEN), { wrapper });
    await result.current.mutateAsync();

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/invitations/accept',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Invitation-Token': TOKEN },
      }),
    );
    expect(apiFetchMock.mock.calls[0][0]).not.toContain(TOKEN);
  });

  it('useDeclineInvitation POSTs /decline with the X-Invitation-Token header', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeclineInvitation(TOKEN), { wrapper });
    await result.current.mutateAsync();

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/invitations/accept/decline',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Invitation-Token': TOKEN },
      }),
    );
    expect(apiFetchMock.mock.calls[0][0]).not.toContain(TOKEN);
  });

  it('useInvitationPreview GETs the static path with the X-Invitation-Token header', async () => {
    apiFetchMock.mockResolvedValueOnce({ data: { status: 'not_found' } });

    renderHook(() => useInvitationPreview(TOKEN), { wrapper });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/invitations/accept',
      expect.objectContaining({
        headers: { 'X-Invitation-Token': TOKEN },
      }),
    );
    expect(apiFetchMock.mock.calls[0][0]).not.toContain(TOKEN);
  });
});
