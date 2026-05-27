/**
 * Formatadores PT-BR centralizados. Sempre via Intl — sem templates manuais.
 */

let relativeFormatter: Intl.RelativeTimeFormat | null = null;
let absoluteFormatter: Intl.DateTimeFormat | null = null;

function getRelativeFormatter(): Intl.RelativeTimeFormat {
  if (!relativeFormatter) {
    relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
      numeric: 'auto',
    });
  }
  return relativeFormatter;
}

function getAbsoluteFormatter(): Intl.DateTimeFormat {
  if (!absoluteFormatter) {
    absoluteFormatter = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
    });
  }
  return absoluteFormatter;
}

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

/**
 * Formata um ISO datetime como tempo relativo PT-BR ("há 2 meses").
 * Para datas no futuro retorna a forma absoluta — improvável aqui.
 */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = date.getTime() - Date.now();
  if (diff > 0) return formatAbsolute(iso);

  for (const { unit, ms } of UNITS) {
    const value = Math.round(diff / ms);
    if (Math.abs(value) >= 1) {
      return getRelativeFormatter().format(value, unit);
    }
  }
  return getRelativeFormatter().format(0, 'second');
}

export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return getAbsoluteFormatter().format(date);
}
