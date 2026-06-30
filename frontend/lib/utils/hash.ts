/**
 * cyrb53 — hash 53-bit estável e barato. Usado para escolher um slot de cor
 * a partir do org.id (ver spec 02 §6 e spec 04 avatar de usuário).
 *
 * Determinístico → mesma org sempre exibe a mesma cor.
 */
export function cyrb53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const AVATAR_SLOTS = [
  { light: 'hsl(239 84% 56%)', dark: 'hsl(234 89% 74%)', textOnLight: 'white' },
  { light: 'hsl(142 71% 45%)', dark: 'hsl(142 65% 55%)', textOnLight: 'white' },
  { light: 'hsl(38 92% 50%)', dark: 'hsl(38 95% 60%)', textOnLight: 'white' },
  { light: 'hsl(0 72% 51%)', dark: 'hsl(0 85% 65%)', textOnLight: 'white' },
  { light: 'hsl(280 70% 55%)', dark: 'hsl(280 80% 70%)', textOnLight: 'white' },
  { light: 'hsl(190 80% 45%)', dark: 'hsl(190 80% 60%)', textOnLight: 'white' },
  { light: 'hsl(330 75% 55%)', dark: 'hsl(330 80% 70%)', textOnLight: 'white' },
  {
    light: 'hsl(60 70% 45%)',
    dark: 'hsl(50 90% 60%)',
    textOnLight: 'hsl(222 47% 11%)',
  },
] as const;

export interface AvatarColor {
  /** CSS color string para light mode (uso direto em style.background). */
  light: string;
  dark: string;
  textOnLight: string;
}

export function getAvatarColorIndex(seed: string): number {
  return cyrb53(seed) % AVATAR_SLOTS.length;
}

export function getAvatarColor(seed: string): AvatarColor {
  return AVATAR_SLOTS[getAvatarColorIndex(seed)] ?? AVATAR_SLOTS[0];
}

export function getAvatarColorForOrg(orgId: string): AvatarColor {
  return getAvatarColor(orgId);
}
