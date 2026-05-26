/**
 * Skeleton exibido enquanto o Server Component de `/me` ainda está renderizando
 * (streaming Next 14). Respeita `motion-reduce`.
 */
export default function MeLoading() {
  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header
          aria-hidden="true"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <div className="h-3 w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          </div>
        </header>

        <section
          aria-hidden="true"
          className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="flex flex-col gap-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          </div>
        </section>

        <span className="sr-only">Carregando seus dados…</span>
      </div>
    </main>
  );
}
