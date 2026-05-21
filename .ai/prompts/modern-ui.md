# Prompt: Modern UI Creation

## Uso
Use para criar componentes e páginas com design moderno, acessível e responsivo.

---

## Prompt Completo para Nova Página

```
Você é o uiux-agent + frontend-agent trabalhando juntos.

Criar a página: [Nome da Página]

Propósito:
[O que o usuário faz nessa página em 1-2 frases]
Exemplo: "Página de listagem de faturas onde o usuário pode ver, filtrar e criar faturas."

Dados disponíveis (da API):
[Descrever os dados que serão exibidos]
Exemplo:
{
  invoices: [{ id, number, status, total_amount, client.name, due_date, created_at }]
  meta: { total, current_page, last_page }
}

Ações disponíveis:
- [ação 1]: [descrição]
- [ação 2]: [descrição]
Exemplo:
- Criar nova fatura: abre modal de criação
- Filtrar por status: dropdown com opções
- Buscar por número/cliente: input de busca
- Clicar em fatura: navegar para página de detalhe

Layout:
[Descrever estrutura visual]
Exemplo:
- Header com título "Faturas" e botão "Nova Fatura"
- Barra de filtros (status, data, busca)
- Tabela/lista de faturas com paginação
- Empty state quando sem resultados

Stack:
- Next.js 14 App Router (Server Component para fetch inicial)
- Tailwind CSS com tokens do projeto
- shadcn/ui para componentes base
- TanStack Query para estado de dados no cliente
- Framer Motion para transições

Requisitos de UX:
- Mobile-first, responsivo até mobile (320px)
- Skeleton loader enquanto carrega
- Empty state com CTA
- Feedback visual de ações (toast de sucesso/erro)
- Paginação ou infinite scroll
- Acessível: navegação por teclado, screen reader friendly

Entregar:
1. Wireframe em ASCII do layout
2. Componentes necessários listados
3. Código completo dos componentes principais
4. Hook de dados (useInvoices)
5. Página Server Component (page.tsx)
```

---

## Prompt para Componente de UI Específico

```
Você é o uiux-agent + frontend-agent.

Criar o componente: [NomeDoComponente]

Descrição:
[O que o componente faz e onde é usado]

Props necessárias:
[Listar props com tipos]
Exemplo:
interface InvoiceCardProps {
  invoice: {
    id: string;
    number: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    total_amount: number;
    client_name: string;
    due_date: string;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

Estados a suportar:
- [ ] Default
- [ ] Hover (efeito visual)
- [ ] Loading (skeleton ou spinner interno)
- [ ] Error state
- [ ] Selecionado (se aplicável)

Design:
- Seguir tokens do tailwind.config.ts
- [descrever visual desejado ou referenciar componente existente]
- Bordas arredondadas com `rounded-xl`
- Sombra sutil `shadow-card`
- Padding interno `p-5`

Acessibilidade:
- role e aria-label adequados
- Focusable com teclado
- Contraste adequado

Gerar:
1. Código TypeScript completo do componente
2. Exemplo de uso
3. Teste básico de renderização
```

---

## Prompt para Dashboard/Analytics

```
Você é o uiux-agent + frontend-agent.

Criar seção de dashboard com métricas:

Métricas para exibir:
[Listar KPIs]
Exemplo:
- Total de faturas (este mês): número com variação % vs mês anterior
- Valor total faturado: moeda com variação
- Faturas pendentes: número e valor total
- Taxa de pagamento: percentual

Dados da API:
GET /api/v1/dashboard/stats → {
  invoices_count: number,
  invoices_delta: number,    // variação percentual
  revenue: number,
  revenue_delta: number,
  pending_count: number,
  pending_amount: number,
  payment_rate: number,
}

Design do MetricCard:
- Ícone representativo (Lucide)
- Número grande em destaque
- Label descritivo
- Badge de variação: verde se positivo, vermelho se negativo
- Skeleton enquanto carrega
- Responsive: 2 colunas mobile, 4 colunas desktop

Gráfico (se necessário):
- Tipo: [linha / barra / pizza]
- Dados: [descrever série temporal ou categorias]
- Biblioteca: Recharts (já disponível)
- Responsivo, sem overflow em mobile

Entregar código completo e tipado.
```

---

## Prompt para Modal/Dialog

```
Você é o uiux-agent + frontend-agent.

Criar modal para: [ação]
Exemplo: "Confirmar exclusão de fatura" ou "Criar novo cliente"

Tipo:
- [ ] Modal de confirmação (sim/não)
- [ ] Modal de formulário (criar/editar)
- [ ] Modal de detalhe (visualização)

Se formulário, campos:
[listar campos com validação]

Comportamento:
- Abrir via botão [X] ou evento [Y]
- Fechar com: ESC, clique fora, botão X, submit com sucesso
- Foco: ir para primeiro campo ao abrir
- Scroll: conteúdo scroll interno se modal for alto

Design:
- Overlay: `bg-black/50 backdrop-blur-sm`
- Conteúdo: `bg-surface-raised rounded-2xl shadow-modal p-6 max-w-md w-full`
- Animação: fade + scale (Framer Motion)
- Header com título + botão fechar (X)
- Footer com ações primária e secundária alinhadas à direita

Acessibilidade:
- `role="dialog"` com `aria-modal="true"`
- `aria-labelledby` apontando para o título
- Focus trap dentro do modal
- ESC fecha
- Anúncio para screen readers ao abrir

Usar Radix UI Dialog como primitiva base (via shadcn/ui).
```

---

## Prompt para Empty State

```
Você é o uiux-agent + frontend-agent.

Criar empty state para: [contexto — ex: lista de faturas vazia, busca sem resultados]

Cenários:
1. Primeiro uso (nunca teve dados): mensagem encorajadora + CTA primário
2. Busca sem resultado: mensagem específica + sugestão de limpar filtros
3. Erro de carregamento: mensagem de erro + botão retry

Design:
- Ícone/ilustração SVG relacionado ao contexto (Lucide ou inline SVG)
- Título: 3-5 palavras
- Subtítulo: 1-2 frases explicativas, tom amigável
- CTA: botão primário para ação principal (apenas no caso 1)

Dimensões:
- Ocupa todo o espaço disponível do container pai
- Centralizado vertical e horizontalmente
- Max-width: 320px para o texto (não largo demais)

Exemplo de empty state bem feito:
[ícone de fatura com lápis]
"Nenhuma fatura ainda"
"Crie sua primeira fatura e comece a rastrear seus pagamentos com facilidade."
[+ Criar Primeira Fatura]

Entregar: componente EmptyState reutilizável que aceita
título, subtítulo, ícone e onAction como props.
```
