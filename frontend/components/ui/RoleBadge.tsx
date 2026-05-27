import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import type { Role } from '@/lib/types/api';

export interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const variantClasses: Record<Role, string> = {
  owner: 'bg-accent-soft text-accent',
  admin: 'bg-info-soft text-info',
  member: 'bg-surface-sunken text-text-muted',
};

/**
 * Pílula compacta para a função (role) do membro/usuário. Texto curto
 * (`Dono`, `Admin`, `Membro`); o nome formal vai no tooltip do caller.
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      title={t.orgs.roleFull[role]}
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium',
        variantClasses[role],
        className,
      )}
    >
      {t.orgs.roleBadge[role]}
    </span>
  );
}
