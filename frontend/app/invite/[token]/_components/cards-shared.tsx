/**
 * Estados de card que a página de aceite pode renderizar no client.
 *
 * O Server Component decide o estado inicial via preview; durante a
 * interação client, o `AcceptForm` pode trocar o card quando o backend
 * responde com 410/422 (race condition entre preview e POST).
 */
export type ClientCardState =
  | 'expired'
  | 'revoked'
  | 'wrong-email'
  | 'invalid';
