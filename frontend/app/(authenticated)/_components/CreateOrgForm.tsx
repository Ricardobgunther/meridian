'use client';

import { forwardRef, type FormEvent } from 'react';

import { t } from '@/lib/i18n/t';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SlugAvailability } from '@/components/ui/SlugAvailability';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import type { SlugCheckStatus } from '@/lib/types/api';

export interface CreateOrgFormErrors {
  name?: string;
  slug?: string;
}

export interface CreateOrgFormProps {
  name: string;
  slug: string;
  errors: CreateOrgFormErrors;
  /** Status advisory de disponibilidade do slug (useCheckSlug no modal). */
  slugStatus: SlugCheckStatus;
  isSubmitting: boolean;
  canSubmit: boolean;
  onNameChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onBlur: (field: 'name' | 'slug') => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

/**
 * Form puro do CreateOrgModal — sem estado próprio. O modal injeta os
 * valores e callbacks. Mantém o modal compacto e o form testável isolado.
 */
export const CreateOrgForm = forwardRef<HTMLInputElement, CreateOrgFormProps>(
  function CreateOrgForm(
    {
      name,
      slug,
      errors,
      slugStatus,
      isSubmitting,
      canSubmit,
      onNameChange,
      onSlugChange,
      onBlur,
      onSubmit,
      onCancel,
    },
    nameRef,
  ) {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="org-name"
            className="text-sm font-medium text-text-primary"
          >
            {t.orgs.create.nameLabel}
          </label>
          <Input
            id="org-name"
            ref={nameRef}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => onBlur('name')}
            placeholder={t.orgs.create.namePlaceholder}
            aria-required="true"
            aria-describedby={
              errors.name ? 'org-name-error' : 'org-name-helper'
            }
            invalid={Boolean(errors.name)}
            disabled={isSubmitting}
            maxLength={120}
          />
          {errors.name ? (
            <p id="org-name-error" role="alert" className="text-sm text-danger">
              {errors.name}
            </p>
          ) : (
            <p id="org-name-helper" className="text-sm text-text-muted">
              {t.orgs.create.nameHelper}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="org-slug"
            className="text-sm font-medium text-text-primary"
          >
            {t.orgs.create.slugLabel}
          </label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            onBlur={() => onBlur('slug')}
            placeholder={t.orgs.create.slugPlaceholder}
            aria-required="true"
            aria-describedby={
              errors.slug ? 'org-slug-error' : 'org-slug-helper'
            }
            invalid={Boolean(errors.slug)}
            disabled={isSubmitting}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
          />
          {errors.slug ? (
            <p id="org-slug-error" role="alert" className="text-sm text-danger">
              {errors.slug}
            </p>
          ) : (
            <p id="org-slug-helper" className="text-sm text-text-muted">
              {t.orgs.create.slugHelper.replace(
                '{slug}',
                slug || 'acme-brasil',
              )}
            </p>
          )}
          {/* Canal paralelo e mais suave que o slot de erro do form: não
              entra no aria-describedby (live region já alcança SRs) e não
              seta aria-invalid — o valor é input válido, só (advisoriamente)
              indisponível (spec 03 §2/§3). */}
          <SlugAvailability status={slugStatus} />
        </div>

        <div className="mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            className="max-sm:w-full"
          >
            {t.orgs.create.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="max-sm:w-full"
          >
            {isSubmitting && <SpinnerIcon className="h-4 w-4" />}
            {isSubmitting ? t.orgs.create.submitting : t.orgs.create.submit}
          </Button>
        </div>
      </form>
    );
  },
);
