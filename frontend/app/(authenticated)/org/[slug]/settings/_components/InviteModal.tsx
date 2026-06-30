'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Dialog } from '@/components/ui/Dialog';
import type { RadioCardOption } from '@/components/ui/RadioCardGroup';
import { announce } from '@/lib/a11y/announce';
import { parseApiError } from '@/lib/api/errors';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';
import { useCreateInvitation } from '@/hooks/use-create-invitation';
import type { InvitationRole } from '@/lib/types/api';

import { InviteForm } from './InviteForm';

interface InviteModalProps {
  orgId: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_EMAIL = '';
const INITIAL_ROLE: InvitationRole = 'member';

function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return t.invitations.modal.errors.emailRequired;
  if (!EMAIL_RE.test(v)) return t.invitations.modal.errors.emailInvalid;
  return undefined;
}

/**
 * Modal "Convidar membro". Aberto via `useUiStore.openModal({ kind: 'invite-member' })`.
 *
 * Estado local:
 *  - email + role (controlados),
 *  - emailError (inline) — limpa em qualquer edição depois do primeiro blur,
 *  - touched (não validar a cada keystroke antes do primeiro blur).
 *
 * Mapeamento de erros do backend (full table em spec 06 §1):
 *  - 409 invitation_already_member → inline
 *  - 409 invitation_already_pending → inline
 *  - 422 com `fieldErrors.email`   → inline
 *  - 429                            → toast rate-limited
 *  - 403                            → toast forbidden + close (patológico)
 *  - outros                         → toast genérico
 */
export function InviteModal({ orgId }: InviteModalProps) {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const open = activeModal?.kind === 'invite-member';

  const [email, setEmail] = useState(INITIAL_EMAIL);
  const [role, setRole] = useState<InvitationRole>(INITIAL_ROLE);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const mutation = useCreateInvitation(orgId);

  useEffect(() => {
    if (open) {
      setEmail(INITIAL_EMAIL);
      setRole(INITIAL_ROLE);
      setEmailError(undefined);
      setTouched(false);
    }
  }, [open]);

  const roleOptions: ReadonlyArray<RadioCardOption<InvitationRole>> = [
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

  function handleEmailChange(value: string) {
    setEmail(value);
    if (touched) setEmailError(validateEmail(value));
  }

  function handleEmailBlur() {
    setTouched(true);
    setEmailError(validateEmail(email));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    const localErr = validateEmail(email);
    setEmailError(localErr);
    if (localErr) {
      emailInputRef.current?.focus();
      return;
    }

    try {
      await mutation.mutateAsync({ email: email.trim(), role });
      toast.success(t.invitations.modal.sentToastTitle, {
        description: t.invitations.modal.sentToastBody(email.trim()),
      });
      announce(t.invitations.modal.sentAnnouncement(email.trim()));
      closeModal();
    } catch (err) {
      handleSubmitError(err);
    }
  }

  function handleSubmitError(err: unknown) {
    const parsed = parseApiError(err);

    if (parsed.domainCode === 'invitation_already_member') {
      setEmailError(t.invitations.modal.errors.emailAlreadyMember);
      emailInputRef.current?.focus();
      return;
    }
    if (parsed.domainCode === 'invitation_already_pending') {
      setEmailError(t.invitations.modal.errors.emailAlreadyPending);
      emailInputRef.current?.focus();
      return;
    }
    if (parsed.fieldErrors?.email) {
      setEmailError(parsed.fieldErrors.email);
      emailInputRef.current?.focus();
      return;
    }
    if (parsed.code === 'rate_limited' || parsed.status === 429) {
      toast.error(t.invitations.modal.errors.rateLimitedTitle, {
        description: t.invitations.modal.errors.rateLimitedBody,
      });
      return;
    }
    if (parsed.code === 'forbidden') {
      toast.error(t.invitations.modal.errors.forbidden);
      closeModal();
      return;
    }
    if (parsed.code === 'network') {
      toast.error(t.invitations.modal.errors.network);
      return;
    }
    toast.error(t.invitations.modal.errors.generic, {
      description: parsed.message,
    });
  }

  const isSubmitting = mutation.isPending;
  const canSubmit = !isSubmitting && email.trim().length > 0 && !emailError;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
      title={t.invitations.modal.title}
      description={t.invitations.modal.description}
      descriptionId="invite-modal-desc"
      closeLabel={t.invitations.modal.closeLabel}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        window.setTimeout(() => emailInputRef.current?.focus(), 0);
      }}
    >
      <InviteForm
        ref={emailInputRef}
        email={email}
        role={role}
        emailError={emailError}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        roleOptions={roleOptions}
        onEmailChange={handleEmailChange}
        onEmailBlur={handleEmailBlur}
        onRoleChange={setRole}
        onSubmit={handleSubmit}
        onCancel={closeModal}
      />
    </Dialog>
  );
}
