import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { MemberRoleControl } from './MemberRoleControl';
import type { Role } from '@/lib/types/api';

const onSelect = vi.fn();

beforeEach(() => {
  onSelect.mockReset();
});

function renderControl(
  overrides: {
    currentRole?: Role;
    viewerRole?: Role;
    canChangeRole?: boolean;
    lockReason?: string;
  } = {},
) {
  return render(
    <MemberRoleControl
      currentRole={overrides.currentRole ?? 'member'}
      memberName="Fulana"
      viewerRole={overrides.viewerRole ?? 'owner'}
      canChangeRole={overrides.canChangeRole ?? true}
      lockReason={overrides.lockReason ?? ''}
      onSelect={onSelect}
    />,
  );
}

describe('MemberRoleControl', () => {
  it('does not offer "Dono" (owner) as a selectable option when viewer is owner', async () => {
    const user = userEvent.setup();
    renderControl({ currentRole: 'admin', viewerRole: 'owner' });

    await user.click(screen.getByRole('button'));

    const menu = await screen.findByRole('menu');
    const options = within(menu).getAllByRole('menuitem');
    const labels = options.map((opt) => opt.textContent?.trim());
    expect(labels).toEqual(expect.arrayContaining(['Administrador', 'Membro']));
    expect(labels).not.toContain('Proprietário');
    expect(labels).not.toContain('Dono');
  });

  it('renders a locked badge (no dropdown) when current role is owner', () => {
    renderControl({ currentRole: 'owner', viewerRole: 'owner' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a locked badge when canChangeRole is false', () => {
    renderControl({
      currentRole: 'admin',
      viewerRole: 'admin',
      canChangeRole: false,
      lockReason: 'Você não pode alterar a si mesmo.',
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
