'use client';

import { forwardRef, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  RadioCardGroup,
  type RadioCardOption,
} from '@/components/ui/RadioCardGroup';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { t } from '@/lib/i18n/t';
import type { InvitationRole } from '@/lib/types/api';

export interface InviteFormProps {
  email: string;
  role: InvitationRole;
  emailError?: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  roleOptions: ReadonlyArray<RadioCardOption<InvitationRole>>;
  onEmailChange: (v: string) => void;
  onEmailBlur: () => void;
  onRoleChange: (v: InvitationRole) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

/**
 * Form puro do InviteModal — sem estado próprio. O modal injeta valores
 * e callbacks. Permite que o modal fique sob o limite de 200 linhas.
 */
export const InviteForm = forwardRef<HTMLInputElement, InviteFormProps>(
  function InviteForm(
    {
      email,
      role,
      emailError,
      isSubmitting,
      canSubmit,
      roleOptions,
      onEmailChange,
      onEmailBlur,
      onRoleChange,
      onSubmit,
      onCancel,
    },
    emailRef,
  ) {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="invite-email"
            className="text-sm font-medium text-text-primary"
          >
            {t.invitations.modal.emailLabel}
          </label>
          <Input
            id="invite-email"
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={onEmailBlur}
            placeholder={t.invitations.modal.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            aria-required="true"
            aria-describedby={
              emailError ? 'invite-email-error' : 'invite-email-helper'
            }
            invalid={Boolean(emailError)}
            disabled={isSubmitting}
            maxLength={254}
          />
          {emailError ? (
            <p
              id="invite-email-error"
              role="alert"
              className="text-xs text-danger"
            >
              {emailError}
            </p>
          ) : (
            <p id="invite-email-helper" className="text-xs text-text-muted">
              {t.invitations.modal.emailHelper}
            </p>
          )}
        </div>

        <RadioCardGroup
          label={t.invitations.modal.roleLabel}
          value={role}
          onChange={(v) => onRoleChange(v)}
          options={roleOptions}
          disabled={isSubmitting}
        />

        <div className="mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            className="max-sm:w-full"
          >
            {t.invitations.modal.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="max-sm:w-full"
          >
            {isSubmitting && <SpinnerIcon className="h-4 w-4" />}
            {isSubmitting
              ? t.invitations.modal.submitting
              : t.invitations.modal.submit}
          </Button>
        </div>
      </form>
    );
  },
);
