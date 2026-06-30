import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteForm } from './InviteForm';
import type { RadioCardOption } from '@/components/ui/RadioCardGroup';
import { t } from '@/lib/i18n/t';
import type { InvitationRole } from '@/lib/types/api';

const ROLE_OPTIONS: ReadonlyArray<RadioCardOption<InvitationRole>> = [
  {
    value: 'member',
    title: t.invitations.modal.roleMemberTitle,
    description: t.invitations.modal.roleMemberDescription,
  },
  {
    value: 'admin',
    title: t.invitations.modal.roleAdminTitle,
    description: t.invitations.modal.roleAdminDescription,
  },
];

const onEmailChange = vi.fn();
const onEmailBlur = vi.fn();
const onRoleChange = vi.fn();
const onSubmit = vi.fn();
const onCancel = vi.fn();

function renderForm(
  overrides: Partial<React.ComponentProps<typeof InviteForm>> = {},
) {
  const ref = createRef<HTMLInputElement>();
  const utils = render(
    <InviteForm
      ref={ref}
      email={overrides.email ?? ''}
      role={overrides.role ?? 'member'}
      emailError={overrides.emailError}
      isSubmitting={overrides.isSubmitting ?? false}
      canSubmit={overrides.canSubmit ?? true}
      roleOptions={overrides.roleOptions ?? ROLE_OPTIONS}
      onEmailChange={overrides.onEmailChange ?? onEmailChange}
      onEmailBlur={overrides.onEmailBlur ?? onEmailBlur}
      onRoleChange={overrides.onRoleChange ?? onRoleChange}
      onSubmit={overrides.onSubmit ?? onSubmit}
      onCancel={overrides.onCancel ?? onCancel}
    />,
  );
  return { ...utils, ref };
}

beforeEach(() => {
  onEmailChange.mockReset();
  onEmailBlur.mockReset();
  onRoleChange.mockReset();
  onSubmit.mockReset();
  onCancel.mockReset();
});

describe('InviteForm — rendering & wiring', () => {
  it('renders the email input with controlled value and helper text', () => {
    renderForm({ email: 'bruno@acme.com' });

    const input = screen.getByLabelText(t.invitations.modal.emailLabel) as HTMLInputElement;
    expect(input.value).toBe('bruno@acme.com');
    expect(
      screen.getByText(t.invitations.modal.emailHelper),
    ).toBeInTheDocument();
  });

  it('renders both role options (member, admin)', () => {
    renderForm();

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getByText(t.invitations.modal.roleMemberTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.invitations.modal.roleAdminTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.invitations.modal.roleMemberDescription),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.invitations.modal.roleAdminDescription),
    ).toBeInTheDocument();
  });

  it('exposes the input through the forwarded ref', () => {
    const { ref } = renderForm();
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('shows the helper when no error is set', () => {
    renderForm();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(t.invitations.modal.emailHelper)).toBeInTheDocument();
  });

  it('shows the inline error alert (and hides the helper) when emailError is set', () => {
    renderForm({ emailError: t.invitations.modal.errors.emailInvalid });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.invitations.modal.errors.emailInvalid);
    expect(
      screen.queryByText(t.invitations.modal.emailHelper),
    ).not.toBeInTheDocument();
  });
});

describe('InviteForm — interactions', () => {
  it('calls onEmailChange on each keystroke', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(t.invitations.modal.emailLabel), 'a');
    expect(onEmailChange).toHaveBeenCalledWith('a');
  });

  it('calls onEmailBlur when the input loses focus', async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText(t.invitations.modal.emailLabel);
    await user.click(input);
    await user.tab();

    expect(onEmailBlur).toHaveBeenCalled();
  });

  it('calls onRoleChange when the admin radio is selected', async () => {
    const user = userEvent.setup();
    renderForm({ role: 'member' });

    // Click the admin <label> (which wraps the radio) — Radix radios in jsdom
    // sometimes need the label click to trigger onValueChange reliably.
    await user.click(
      screen.getByText(t.invitations.modal.roleAdminDescription),
    );

    expect(onRoleChange).toHaveBeenCalledWith('admin');
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.cancel }),
    );

    expect(onCancel).toHaveBeenCalled();
  });

  it('submits the form when the user clicks the submit button', async () => {
    const user = userEvent.setup();
    renderForm({ canSubmit: true });

    await user.click(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    );

    expect(onSubmit).toHaveBeenCalled();
  });
});

describe('InviteForm — submitting state', () => {
  it('disables fields and shows the busy label when isSubmitting', () => {
    renderForm({ isSubmitting: true, canSubmit: false });

    expect(screen.getByLabelText(t.invitations.modal.emailLabel)).toBeDisabled();
    expect(
      screen.getByRole('button', { name: t.invitations.modal.cancel }),
    ).toBeDisabled();

    const submit = screen.getByRole('button', {
      name: new RegExp(t.invitations.modal.submitting, 'i'),
    });
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(submit).toBeDisabled();
  });

  it('keeps submit disabled when canSubmit is false even outside of loading', () => {
    renderForm({ isSubmitting: false, canSubmit: false });

    expect(
      screen.getByRole('button', { name: t.invitations.modal.submit }),
    ).toBeDisabled();
  });
});
