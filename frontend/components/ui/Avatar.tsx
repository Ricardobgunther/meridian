import { cn } from '@/lib/utils';
import { getAvatarColor } from '@/lib/utils/hash';

export interface AvatarProps {
  /** Seed estável para cor (geralmente id da entidade). */
  seed: string;
  /** Nome ou e-mail — usado para iniciais e label acessível. */
  label: string;
  /** URL de imagem opcional. Se ausente, mostra iniciais. */
  imageUrl?: string | null;
  /** Tamanho em px. Default 32. */
  size?: number;
  className?: string;
}

function initialsOf(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Círculo com iniciais coloridas (ou imagem). Cor determinística por seed
 * — ver `getAvatarColor`. Em modo escuro o componente herda automaticamente
 * a paleta via CSS custom property mas como o `style` é inline, mantemos
 * uma única cor (light) para evitar mismatch — a paleta passa a fazer parte
 * de uma futura sprite. Aceitável para v1.
 */
export function Avatar({
  seed,
  label,
  imageUrl,
  size = 32,
  className,
}: AvatarProps) {
  const { light } = getAvatarColor(seed);
  const initials = initialsOf(label);
  const sizeStyle = { width: `${size}px`, height: `${size}px` };

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        style={sizeStyle}
        className={cn(
          'shrink-0 rounded-pill bg-surface-sunken object-cover',
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...sizeStyle, backgroundColor: light, color: '#ffffff' }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill font-medium leading-none',
        size <= 24 ? 'text-[10px]' : size <= 32 ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      {initials}
    </span>
  );
}
