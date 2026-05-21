# Skill: Frontend Design Patterns

## Quando Usar
Em qualquer trabalho com componentes React, hooks, estado e integração de dados no frontend.

## Arquitetura de Componentes

### Separação de Responsabilidades
```
Page Component         → composição de seções, fetch de dados (Server Component)
  Section Component    → bloco de UI com lógica de apresentação
    Feature Component  → componente específico de domínio (InvoiceCard)
      UI Component     → componente genérico reutilizável (Button, Badge)
```

```tsx
// page.tsx — Server Component, busca dados e compõe
export default async function InvoicesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: invoices } = await supabase.from('invoices').select('...');

  return (
    <div className="flex flex-col gap-6 p-6">
      <InvoicesHeader />
      <InvoiceFilters />
      <InvoiceTable initialData={invoices} />
    </div>
  );
}

// InvoiceTable.tsx — Client Component com estado
'use client';
export function InvoiceTable({ initialData }: { initialData: Invoice[] }) {
  const { data: invoices } = useInvoices({ initialData });
  useInvoiceRealtime();

  if (invoices.length === 0) return <InvoicesEmptyState />;

  return (
    <div className="rounded-xl border border-border">
      {invoices.map((invoice) => (
        <InvoiceRow key={invoice.id} invoice={invoice} />
      ))}
    </div>
  );
}
```

## Custom Hooks — Padrão

```typescript
// hooks/use-invoices.ts — separar lógica de dado da UI
export function useInvoices(options?: { initialData?: Invoice[] }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: () => invoiceApi.list(user!.id),
    initialData: options?.initialData,
    staleTime: 30_000,
    enabled: !!user,
  });
}

// hooks/use-create-invoice.ts — mutação com optimistic update
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateInvoicePayload) => invoiceApi.create(data),

    onMutate: async (newInvoice) => {
      // Cancelar refetches pendentes
      await queryClient.cancelQueries({ queryKey: ['invoices'] });

      // Snapshot do estado anterior
      const previousInvoices = queryClient.getQueryData<Invoice[]>(['invoices']);

      // Update otimista
      queryClient.setQueryData<Invoice[]>(['invoices'], (old = []) => [
        { id: 'temp-' + Date.now(), ...newInvoice, status: 'draft' } as Invoice,
        ...old,
      ]);

      return { previousInvoices };
    },

    onError: (error, _variables, context) => {
      // Reverter em caso de erro
      if (context?.previousInvoices) {
        queryClient.setQueryData(['invoices'], context.previousInvoices);
      }
      toast({ title: 'Erro ao criar fatura', description: error.message, variant: 'destructive' });
    },

    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Fatura criada com sucesso!' });
    },
  });
}
```

## Formulários — React Hook Form + Zod

```typescript
// schemas/invoice.schema.ts
import { z } from 'zod';

export const createInvoiceSchema = z.object({
  client_id: z.string().uuid('Selecione um cliente válido'),
  due_date:  z.string().refine(
    (d) => new Date(d) > new Date(),
    'A data de vencimento deve ser futura'
  ),
  items: z.array(z.object({
    description: z.string().min(1, 'Descrição obrigatória').max(500),
    quantity:    z.number().int().min(1, 'Mínimo 1').max(9999),
    unit_price:  z.number().min(0.01, 'Valor mínimo R$ 0,01'),
  })).min(1, 'Adicione pelo menos um item'),
  notes: z.string().max(2000).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// components/features/InvoiceForm.tsx
export function InvoiceForm({ onSuccess }: { onSuccess: (invoice: Invoice) => void }) {
  const createInvoice = useCreateInvoice();

  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { items: [{ description: '', quantity: 1, unit_price: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  async function onSubmit(data: CreateInvoiceInput) {
    const invoice = await createInvoice.mutateAsync(data);
    onSuccess(invoice);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente</FormLabel>
              <FormControl>
                <ClientSelect {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... outros campos ... */}
        <Button type="submit" disabled={createInvoice.isPending}>
          {createInvoice.isPending ? 'Criando...' : 'Criar Fatura'}
        </Button>
      </form>
    </Form>
  );
}
```

## Error Boundaries

```tsx
// components/error-boundary.tsx
'use client';
export function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('ErrorBoundary caught:', error);
    // Enviar para serviço de monitoramento (Sentry, etc.)
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircle className="h-12 w-12 text-feedback-error" />
      <h2 className="text-heading-md text-text-primary">Algo deu errado</h2>
      <p className="text-body-md text-text-secondary max-w-md">
        Ocorreu um erro inesperado. Nossa equipe foi notificada.
      </p>
      <Button onClick={reset} variant="secondary">Tentar novamente</Button>
    </div>
  );
}
```

## Performance — Memoization com Propósito

```tsx
// Só usar memo quando:
// 1. Componente re-renderiza frequentemente
// 2. O re-render é caro (lista longa, cálculo pesado)
// 3. Props são estáveis (não objetos inline)

// VÁLIDO — lista de 1000+ itens com ordenação complexa
const SortedInvoiceList = memo(function SortedInvoiceList({ invoices, sort }: Props) {
  const sorted = useMemo(
    () => sortInvoices(invoices, sort),
    [invoices, sort]
  );
  return <div>{sorted.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}</div>;
});

// DESNECESSÁRIO — componente simples que renderiza raramente
const UserAvatar = memo(function UserAvatar({ name }: { name: string }) {
  return <div className="...">{name[0]}</div>;
}); // memo aqui só adiciona overhead
```

## Padrão de Loading States

```tsx
// Skeleton — para listas e cards
function InvoiceListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-border" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-border" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

// Suspense boundary
<Suspense fallback={<InvoiceListSkeleton />}>
  <InvoiceList />
</Suspense>
```

## Acessibilidade — Implementação

```tsx
// Foco gerenciado em modais
export function InvoiceModal({ isOpen, onClose }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus(); // mover foco ao abrir
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()} // controlar foco manualmente
        aria-labelledby="invoice-modal-title"
        aria-describedby="invoice-modal-desc"
      >
        <DialogTitle id="invoice-modal-title">Nova Fatura</DialogTitle>
        <DialogDescription id="invoice-modal-desc">
          Preencha os dados para criar uma nova fatura.
        </DialogDescription>
        {/* ... conteúdo ... */}
        <Button ref={closeRef} variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

## Anti-Patterns Frontend
- `useEffect` para sincronizar estado derivado (calcular na renderização)
- `useState` para dados do servidor (usar TanStack Query)
- `any` em props — sempre tipar explicitamente
- Lógica de negócio em componentes (extrair para hooks)
- Eventos com `onClick={handler()}` em vez de `onClick={handler}`
- Mutação direta de arrays/objetos de estado
- `key={index}` em listas ordenáveis ou filtráveis
