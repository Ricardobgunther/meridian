/**
 * Helpers para anunciar mensagens em live regions globais.
 *
 * As regions ficam no <Shell> (ids: shell-live, shell-alert) — SR-only.
 * Use `announce` para confirmações ("Organização trocada", "Função atualizada")
 * e `announceAlert` para erros urgentes ("Sessão expirada").
 */

function setLiveRegion(id: string, message: string): void {
  if (typeof document === 'undefined') return;
  const node = document.getElementById(id);
  if (!node) return;

  // Truque clássico: limpa e re-aplica para SRs notificarem mesmo se o texto
  // for igual à última mensagem.
  node.textContent = '';
  // Microtarefa garante que o reset chega ao DOM antes da nova string.
  Promise.resolve().then(() => {
    node.textContent = message;
  });
}

export function announce(message: string): void {
  setLiveRegion('shell-live', message);
}

export function announceAlert(message: string): void {
  setLiveRegion('shell-alert', message);
}
