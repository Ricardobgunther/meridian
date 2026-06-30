'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CloudOff } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { t } from '@/lib/i18n/t';
import { isValidSlug, slugify } from '@/lib/utils/string';
import { parseApiError } from '@/lib/api/errors';
import { useActiveOrg } from '@/hooks/use-active-org';
import { useUpdateOrg } from '@/hooks/use-update-org';

import { DangerZone } from './DangerZone';
import { GeneralForm, type GeneralFormErrors } from './GeneralForm';
import { LeaveOrgSection } from './LeaveOrgSection';

interface GeneralTabProps {
  slug: string;
}

/**
 * Aba Geral. Edita nome (admin+owner) e slug (apenas owner). Slug change
 * passa por um diálogo de confirmação dedicado porque URLs antigas quebram.
 */
export function GeneralTab({ slug }: GeneralTabProps) {
  const router = useRouter();
  const { organization, role, isLoading, isError, refetch } =
    useActiveOrg(slug);

  const [name, setName] = useState('');
  const [slugValue, setSlugValue] = useState('');
  const [errors, setErrors] = useState<GeneralFormErrors>({});
  const [confirmSlugOpen, setConfirmSlugOpen] = useState(false);

  const updateMutation = useUpdateOrg(organization?.id ?? '');

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setSlugValue(organization.slug);
      setErrors({});
    }
  }, [organization]);

  if (isLoading) {
    return <GeneralTabSkeleton />;
  }

  if (isError || !organization) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-lg border border-danger/40 bg-danger-soft p-8 text-center"
      >
        <CloudOff className="h-10 w-10 text-danger" aria-hidden="true" />
        <p className="text-sm text-danger">{t.shell.errors.profileBody}</p>
        <Button variant="primary" onClick={refetch}>
          {t.shell.errors.retry}
        </Button>
      </div>
    );
  }

  const canEditName = role === 'owner' || role === 'admin';
  const canEditSlug = role === 'owner';
  const canDelete = role === 'owner';
  const isMemberOnly = role === 'member';
  const isDirty =
    name !== organization.name || slugValue !== organization.slug;
  const isSubmitting = updateMutation.isPending;

  function validate(): GeneralFormErrors {
    const out: GeneralFormErrors = {};
    const n = name.trim();
    if (!n) out.name = t.orgs.create.errors.nameRequired;
    else if (n.length < 2) out.name = t.orgs.create.errors.nameMin;
    else if (n.length > 120) out.name = t.orgs.create.errors.nameMax;

    if (canEditSlug) {
      const s = slugValue.trim();
      if (!s) out.slug = t.orgs.create.errors.slugRequired;
      else if (s.length < 3) out.slug = t.orgs.create.errors.slugMin;
      else if (s.length > 60) out.slug = t.orgs.create.errors.slugMax;
      else if (!isValidSlug(s)) out.slug = t.orgs.create.errors.slugPattern;
    }
    return out;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (v.name || v.slug) return;

    if (canEditSlug && slugValue.trim() !== organization!.slug) {
      setConfirmSlugOpen(true);
      return;
    }
    void saveChanges();
  }

  async function saveChanges() {
    try {
      const trimmedSlug = slugValue.trim();
      const slugChanged = trimmedSlug !== organization!.slug;
      const payload: { name?: string; slug?: string } = {};
      if (name.trim() !== organization!.name) payload.name = name.trim();
      if (canEditSlug && slugChanged) payload.slug = trimmedSlug;

      const updated = await updateMutation.mutateAsync(payload);
      setConfirmSlugOpen(false);
      if (slugChanged) router.replace(`/org/${updated.slug}/settings`);
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
      setConfirmSlugOpen(false);
    }
  }

  function handleCancel() {
    if (organization) {
      setName(organization.name);
      setSlugValue(organization.slug);
      setErrors({});
    }
  }

  return (
    <div className="space-y-6">
      {isMemberOnly && (
        <div
          role="status"
          className="rounded-md border border-info/40 bg-info-soft p-3 text-sm text-text-primary"
        >
          {t.settings.general.memberBanner}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface-elevated p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          {t.settings.general.sectionTitle}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t.settings.general.sectionSubtitle}
        </p>

        <GeneralForm
          name={name}
          slug={slugValue}
          errors={errors}
          canEditName={canEditName}
          canEditSlug={canEditSlug}
          isDirty={isDirty}
          isSubmitting={isSubmitting}
          onNameChange={setName}
          onSlugChange={(v) => setSlugValue(slugify(v, 60))}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </section>

      {/* Entre Informações e Zona de perigo (spec 02 §1): severidade
          crescente — editar → sair → destruir. Visível para todos os papéis;
          por isso NÃO vive dentro do DangerZone (owner-only). */}
      {role && <LeaveOrgSection organization={organization} role={role} />}

      {canDelete && <DangerZone organization={organization} />}

      <ConfirmDialog
        open={confirmSlugOpen}
        onOpenChange={setConfirmSlugOpen}
        title={t.settings.general.confirmSlugTitle}
        description={t.settings.general.confirmSlugBody(
          organization.slug,
          slugValue.trim(),
        )}
        confirmLabel={t.settings.general.confirmSlugConfirm}
        cancelLabel={t.settings.general.confirmSlugCancel}
        variant="danger"
        loading={isSubmitting}
        onConfirm={() => void saveChanges()}
      />
    </div>
  );
}

function GeneralTabSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-elevated p-6">
      <div className="h-6 w-1/3 rounded bg-surface-sunken motion-safe:animate-pulse" />
      <div className="h-10 rounded bg-surface-sunken motion-safe:animate-pulse" />
      <div className="h-10 rounded bg-surface-sunken motion-safe:animate-pulse" />
    </div>
  );
}
