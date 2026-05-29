'use client';

/**
 * Live region polite local da rota /invite/[token].
 *
 * A rota está fora do `(authenticated)` layout — não há `#shell-live`
 * disponível, então a hook `announce()` (que escreve em #shell-live)
 * cairia no vazio. Esta região tem o id próprio `#invite-live` e é
 * consumida pelo `announceInvite()` (lib/a11y/announce.ts).
 */
export function InviteLiveRegion() {
  return (
    <>
      <div
        id="shell-live"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="shell-alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
