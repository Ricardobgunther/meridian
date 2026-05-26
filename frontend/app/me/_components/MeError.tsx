import Link from 'next/link';

import { AlertCircleIcon } from '@/app/_icons/AlertCircleIcon';

export interface MeErrorProps {
  /** Mensagem amigável já pronta para exibir. */
  message?: string;
}

/**
 * Estado de erro do `/me` quando o backend Laravel não retorna 200.
 * Mostra mensagem amigável + link "Tentar novamente" apontando para `/me`.
 */
export function MeError({
  message = 'Não conseguimos carregar seus dados agora. Tente novamente em instantes.',
}: MeErrorProps) {
  return (
    <section
      role="alert"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircleIcon className="h-5 w-5 shrink-0 text-red-600" />
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-red-900">
            Erro ao carregar perfil
          </h2>
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Link
          href="/me"
          className="inline-flex h-9 items-center rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Tentar novamente
        </Link>
      </div>
    </section>
  );
}
