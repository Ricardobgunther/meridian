import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OrgSwitcher } from './OrgSwitcher';
import type { Membership } from '@/lib/types/api';

// Mock useSwitchOrg para capturar chamadas sem dispar router.refresh/queryClient.
const switchOrgMock = vi.fn();
vi.mock('@/hooks/use-switch-org', () => ({
  useSwitchOrg: () => ({ switchOrg: switchOrgMock, pendingId: null }),
}));

// Mock o useUiStore para capturar abertura de modal sem efeitos colaterais.
const openModalMock = vi.fn();
vi.mock('@/lib/stores/ui-store', () => ({
  useUiStore: (selector: (s: { openModal: typeof openModalMock }) => unknown) =>
    selector({ openModal: openModalMock }),
}));

function makeMembership(id: string, name: string): Membership {
  return {
    id: `mem-${id}`,
    role: 'member',
    joined_at: '2025-01-01T00:00:00Z',
    organization: { id, slug: name.toLowerCase().replace(/\s+/g, '-'), name },
  };
}

const MEMBERSHIPS: Membership[] = [
  makeMembership('00000000-0000-0000-0000-000000000001', 'Acme Brasil'),
  makeMembership('00000000-0000-0000-0000-000000000002', 'Globex SaaS'),
  makeMembership('00000000-0000-0000-0000-000000000003', 'Widget Energy'),
];

beforeEach(() => {
  switchOrgMock.mockReset();
  openModalMock.mockReset();
});

describe('OrgSwitcher', () => {
  it('shows empty CTA when memberships is empty', async () => {
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        memberships={[]}
        currentOrgId={null}
        showEmptyCta
      />,
    );
    const cta = screen.getByRole('button', { name: /criar organização/i });
    await user.click(cta);
    expect(openModalMock).toHaveBeenCalledWith({ kind: 'create-org' });
  });

  it('opens panel and lists memberships', async () => {
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        memberships={MEMBERSHIPS}
        currentOrgId={MEMBERSHIPS[0]!.organization.id}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
  });

  it('selects an org on Enter', async () => {
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        memberships={MEMBERSHIPS}
        currentOrgId={MEMBERSHIPS[0]!.organization.id}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    // Move down twice (active at idx 0, go to idx 2)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(switchOrgMock).toHaveBeenCalledTimes(1);
    expect(switchOrgMock.mock.calls[0]?.[0]).toMatchObject({
      id: MEMBERSHIPS[2]!.organization.id,
      name: 'Widget Energy',
    });
  });

  it('does not show search input when fewer than 8 memberships', async () => {
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        memberships={MEMBERSHIPS}
        currentOrgId={MEMBERSHIPS[0]!.organization.id}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows search input when memberships >= 8', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) =>
      makeMembership(`m-${i}`, `Org ${i}`),
    );
    render(
      <OrgSwitcher
        memberships={many}
        currentOrgId={many[0]!.organization.id}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });
});
