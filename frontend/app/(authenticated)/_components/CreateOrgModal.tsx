'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { useUiStore } from '@/lib/stores/ui-store';
import { useCheckSlug } from '@/hooks/use-check-slug';
import { useCreateOrg } from '@/hooks/use-create-org';
import { isValidSlug, slugify } from '@/lib/utils/string';
import { parseApiError } from '@/lib/api/errors';

import { CreateOrgForm, type CreateOrgFormErrors } from './CreateOrgForm';

interface FormState {
  name: string;
  slug: string;
  slugTouched: boolean;
}

const INITIAL_STATE: FormState = { name: '', slug: '', slugTouched: false };

function validate(values: FormState): CreateOrgFormErrors {
  const errors: CreateOrgFormErrors = {};
  const n = values.name.trim();
  if (!n) errors.name = t.orgs.create.errors.nameRequired;
  else if (n.length < 2) errors.name = t.orgs.create.errors.nameMin;
  else if (n.length > 120) errors.name = t.orgs.create.errors.nameMax;

  const s = values.slug.trim();
  if (!s) errors.slug = t.orgs.create.errors.slugRequired;
  else if (s.length < 3) errors.slug = t.orgs.create.errors.slugMin;
  else if (s.length > 60) errors.slug = t.orgs.create.errors.slugMax;
  else if (!isValidSlug(s)) errors.slug = t.orgs.create.errors.slugPattern;

  return errors;
}

/**
 * Modal de criação de organização. Acionado por activeModal === 'create-org'.
 *
 * - Auto-deriva slug do nome até o usuário tocar no campo slug.
 * - Mapeia 422 do Laravel em erros por campo via parseApiError.
 */
export function CreateOrgModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const open = activeModal?.kind === 'create-org';

  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<CreateOrgFormErrors>({});
  const [touched, setTouched] = useState({ name: false, slug: false });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateOrg();
  // Preview advisory de disponibilidade. Durante o submit a checagem é
  // suspensa (passa '') — regra de trigger 3 da spec 03 §1. Observa o VALOR
  // do slug (inclusive auto-derivado do nome), não o touched flag.
  const { status: slugStatus } = useCheckSlug(
    createMutation.isPending ? '' : values.slug,
  );

  useEffect(() => {
    if (open) {
      setValues(INITIAL_STATE);
      setErrors({});
      setTouched({ name: false, slug: false });
    }
  }, [open]);

  function handleNameChange(name: string) {
    setValues((prev) => ({
      ...prev,
      name,
      slug: prev.slugTouched ? prev.slug : slugify(name),
    }));
    if (touched.name) setErrors(validate({ ...values, name }));
  }

  function handleSlugChange(slug: string) {
    setValues((prev) => ({ ...prev, slug, slugTouched: true }));
    if (touched.slug)
      setErrors(validate({ ...values, slug, slugTouched: true }));
  }

  function handleBlur(field: 'name' | 'slug') {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate(values);
    setErrors(v);
    setTouched({ name: true, slug: true });
    if (v.name || v.slug) {
      if (v.name) nameInputRef.current?.focus();
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        slug: values.slug.trim(),
      });
      closeModal();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors) {
        setErrors({
          name: parsed.fieldErrors.name,
          slug: parsed.fieldErrors.slug,
        });
      } else {
        toast.error(parsed.title, { description: parsed.message });
      }
    }
  }

  const isSubmitting = createMutation.isPending;
  const isDirty =
    values.name.trim().length > 0 || values.slug.trim().length > 0;
  const hasClientErrors = Boolean(errors.name || errors.slug);
  const canSubmit = !isSubmitting && isDirty && !hasClientErrors;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-overlay data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby="create-org-desc"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            window.setTimeout(() => nameInputRef.current?.focus(), 0);
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-modal flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface-elevated p-6 shadow-lg',
            'data-[state=open]:animate-scale-in motion-reduce:animate-none',
            'max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-text-primary">
                {t.orgs.create.title}
              </Dialog.Title>
              <Dialog.Description
                id="create-org-desc"
                className="mt-1 text-sm text-text-muted"
              >
                {t.orgs.create.description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="rounded-md p-1 text-text-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <CreateOrgForm
            ref={nameInputRef}
            name={values.name}
            slug={values.slug}
            errors={errors}
            slugStatus={slugStatus}
            isSubmitting={isSubmitting}
            canSubmit={canSubmit}
            onNameChange={handleNameChange}
            onSlugChange={handleSlugChange}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            onCancel={closeModal}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
