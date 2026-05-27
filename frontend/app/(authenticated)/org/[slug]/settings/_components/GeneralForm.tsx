'use client';

import type { FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';
import { t } from '@/lib/i18n/t';

export interface GeneralFormErrors {
  name?: string;
  slug?: string;
}

interface GeneralFormProps {
  name: string;
  slug: string;
  errors: GeneralFormErrors;
  canEditName: boolean;
  canEditSlug: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  onNameChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

/**
 * Form da aba Geral. Inputs controlados; pai (GeneralTab) cuida da carga,
 * validação e mutation. Mantém o componente pai leve.
 */
export function GeneralForm({
  name,
  slug,
  errors,
  canEditName,
  canEditSlug,
  isDirty,
  isSubmitting,
  onNameChange,
  onSlugChange,
  onSubmit,
  onCancel,
}: GeneralFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="org-name"
          className="text-sm font-medium text-text-primary"
        >
          {t.settings.general.nameLabel}
        </label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!canEditName || isSubmitting}
          invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'org-name-error' : undefined}
          maxLength={120}
        />
        {errors.name && (
          <p id="org-name-error" role="alert" className="text-sm text-danger">
            {errors.name}
          </p>
        )}
        {!canEditName && (
          <p className="text-sm text-text-muted">
            {t.settings.general.readonlyAdminNote}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="org-slug"
          className="text-sm font-medium text-text-primary"
        >
          {t.settings.general.slugLabel}
        </label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          disabled={!canEditSlug || isSubmitting}
          invalid={Boolean(errors.slug)}
          aria-describedby={errors.slug ? 'org-slug-error' : 'org-slug-warning'}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
        />
        {errors.slug ? (
          <p id="org-slug-error" role="alert" className="text-sm text-danger">
            {errors.slug}
          </p>
        ) : (
          canEditSlug && (
            <p
              id="org-slug-warning"
              className="flex items-start gap-1 text-sm text-warning"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{t.settings.general.slugWarning}</span>
            </p>
          )
        )}
      </div>

      {(canEditName || canEditSlug) && (
        <div className="mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={!isDirty || isSubmitting}
            className="max-sm:w-full"
          >
            {t.settings.general.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isDirty || isSubmitting}
            aria-busy={isSubmitting}
            className="max-sm:w-full"
          >
            {isSubmitting && <SpinnerIcon className="h-4 w-4" />}
            {isSubmitting ? t.settings.general.saving : t.settings.general.save}
          </Button>
        </div>
      )}
    </form>
  );
}
