import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes Tailwind de forma segura: clsx para condicionais + twMerge
 * para resolver conflitos (ex.: "px-2 px-4" → "px-4").
 *
 * Use sempre que houver classes condicionais. Nunca concatenar strings à mão.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
