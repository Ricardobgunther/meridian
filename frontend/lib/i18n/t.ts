import { dashboard } from './dict/pt-BR/dashboard';
import { invitations } from './dict/pt-BR/invitations';
import { orgs } from './dict/pt-BR/orgs';
import { settings } from './dict/pt-BR/settings';
import { shell } from './dict/pt-BR/shell';

/**
 * Dicionário PT-BR central. Acesso síncrono — sem locale switching nesta versão.
 *
 * Convenção: nenhum literal de texto user-facing deve viver em componente.
 * Use `t.shell.userMenu.logout` em vez de "Sair".
 *
 * Quando uma segunda língua for adicionada, isto vira um Map indexado por
 * `user.locale` (já existe na User). Os componentes não mudam.
 */
export const t = {
  shell,
  orgs,
  settings,
  invitations,
  dashboard,
} as const;

export type Dictionary = typeof t;

/** Helper de pluralização: `plural(n, { one: '1 membro', other: 'X membros' })`. */
export function plural(
  n: number,
  forms: { one: string; other: string },
): string {
  return n === 1
    ? forms.one
    : forms.other.replace('{n}', new Intl.NumberFormat('pt-BR').format(n));
}
