/**
 * Dashboard placeholder. Recebe automaticamente o shell autenticado via
 * o layout do grupo (authenticated). Páginas reais podem substituir.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bem-vindo(a) ao seu painel. Em breve teremos mais informações por aqui.
        </p>
      </header>
      <section className="rounded-lg border border-border bg-surface-elevated p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Primeiros passos
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-text-muted">
          <li>Convide pessoas no menu Membros.</li>
          <li>Ajuste o nome e o identificador em Configurações.</li>
          <li>Personalize este dashboard quando seu produto tiver dados.</li>
        </ul>
      </section>
    </div>
  );
}
