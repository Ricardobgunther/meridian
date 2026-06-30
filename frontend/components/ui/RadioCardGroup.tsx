'use client';

import * as RadioGroup from '@radix-ui/react-radio-group';
import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface RadioCardOption<V extends string> {
  value: V;
  title: string;
  description: string;
}

export interface RadioCardGroupProps<V extends string> {
  /** Texto do label visível. Use junto a `labelId` para `aria-labelledby`. */
  label: string;
  labelId?: string;
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<RadioCardOption<V>>;
  /** Nome do input radio para submit nativo (opcional). */
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Grupo de cartões radio segmentado. Cada opção mostra título + descrição.
 * Stack vertical em mobile, lado-a-lado em md+.
 *
 * Radix `RadioGroup` cobre:
 *  - 1 tab-stop por grupo,
 *  - setas ↑/↓/←/→ ciclam a seleção,
 *  - Enter NÃO submete (mantém foco no grupo).
 *
 * `description` usa `text-muted` mesmo na opção selecionada (delta uiux §5.3:
 * `text-disabled` sobre `accent-soft` falha contraste WCAG).
 */
export function RadioCardGroup<V extends string>({
  label,
  labelId,
  value,
  onChange,
  options,
  name,
  disabled,
  className,
}: RadioCardGroupProps<V>) {
  const autoId = useId();
  const resolvedLabelId = labelId ?? `${autoId}-label`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span
        id={resolvedLabelId}
        className="text-sm font-medium text-text-primary"
      >
        {label}
      </span>
      <RadioGroup.Root
        value={value}
        onValueChange={(v) => onChange(v as V)}
        aria-labelledby={resolvedLabelId}
        name={name}
        disabled={disabled}
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          const cardId = `${autoId}-card-${opt.value}`;
          const descriptionId = `${cardId}-desc`;
          return (
            <label
              key={opt.value}
              htmlFor={cardId}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-fast ease-standard',
                'motion-reduce:transition-none',
                selected
                  ? 'border-accent bg-accent-soft text-text-primary'
                  : 'border-border bg-surface hover:bg-surface-sunken',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <RadioGroup.Item
                id={cardId}
                value={opt.value}
                aria-describedby={descriptionId}
                className={cn(
                  'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                  'border-border bg-surface',
                  'data-[state=checked]:border-accent data-[state=checked]:bg-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated',
                )}
              >
                <RadioGroup.Indicator
                  className="block h-2 w-2 rounded-full bg-accent"
                  aria-hidden="true"
                />
              </RadioGroup.Item>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-text-primary">
                  {opt.title}
                </span>
                <span
                  id={descriptionId}
                  className="text-xs text-text-muted"
                >
                  {opt.description}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}
