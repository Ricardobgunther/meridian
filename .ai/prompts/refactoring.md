# Prompt: Refactoring

## Uso
Use para solicitar refatoração com objetivos claros e preservação de comportamento.

---

## Prompt de Refactoring Completo

```
Você é o [backend-agent / frontend-agent — o mais relevante].

Preciso refatorar o seguinte código. O comportamento deve ser preservado 100%.

## Problema atual
[Descreva o que está errado: muito longo, responsabilidades misturadas,
código duplicado, difícil de testar, acoplamento excessivo etc.]

Exemplo: "Este controller tem 300 linhas com lógica de negócio, validação
e transformação de dados misturados. É impossível testar unitariamente."

## Código atual
[Colar o código a ser refatorado]

## Objetivo da refatoração
[O que deve melhorar especificamente]

Exemplo:
- Extrair lógica de negócio para InvoiceService
- Controller deve ter máximo 5 métodos, cada um com < 15 linhas
- Toda validação em Form Requests separados
- Retorno via API Resources, não arrays diretos

## Restrições
- NÃO mudar o contrato da API (mesmos endpoints, mesma estrutura de resposta)
- NÃO alterar o schema do banco
- Manter todos os testes existentes passando
- NÃO introduzir novas dependências sem justificativa

## Entregáveis
1. Código refatorado com separação de responsabilidades
2. Lista de arquivos criados/modificados/deletados
3. Se houver mudança comportamental não intencional, alertar

Antes de refatorar: confirme que entendeu o comportamento atual
listando o que cada parte do código faz hoje.
```

---

## Prompt para Extrair Service de Controller

```
Você é o backend-agent.

Este controller está muito gordo — preciso extrair a lógica para um Service.

Controller atual:
[colar código]

Extrair para: [NomeService]

Regras:
1. Controller deve chamar apenas $this->service->método(args)
2. Service contém toda a lógica de negócio
3. Operações multi-tabela em DB::transaction()
4. Eventos disparados no Service após commit
5. Controller retorna apenas Resource e status code correto

Mantenha exatamente o mesmo comportamento.
Gere o Service completo e o Controller refatorado.
```

---

## Prompt para Componentizar React

```
Você é o frontend-agent.

Este componente está grande demais e precisa ser quebrado em partes menores.

Componente atual (X linhas):
[colar código]

Problemas identificados:
- [problema 1: ex: mistura lógica de dados com UI]
- [problema 2: ex: três responsabilidades em um componente]
- [problema 3: ex: estado difícil de rastrear]

Objetivo:
Quebrar em componentes menores com responsabilidade única.
Extrair hooks customizados para a lógica de dados.

Estrutura esperada após refatoração:
[nome-da-feature]/
  index.tsx          — componente container (composição)
  FeatureList.tsx    — renderização da lista
  FeatureCard.tsx    — um item
  FeatureFilters.tsx — filtros
  use-feature.ts     — hook de dados
  feature.schema.ts  — validação Zod

Regras:
- Comportamento idêntico ao atual
- Nenhuma prop drilling além de 2 níveis
- TypeScript estrito em todos os componentes
```

---

## Prompt para Eliminar Duplicação

```
Você é o [agente relevante].

Existe código duplicado que precisa ser consolidado.

Ocorrência 1 (arquivo A, linha X):
[colar código]

Ocorrência 2 (arquivo B, linha Y):
[colar código]

Diferenças entre as duas versões:
[listar o que é diferente]

Criar uma abstração reutilizável que:
1. Funciona para ambos os casos
2. Parametriza as diferenças (via argumentos, não herança)
3. É fácil de testar isoladamente
4. Não é over-engineered para casos hipotéticos futuros

Se as diferenças forem pequenas, uma função/componente com parâmetros.
Se forem grandes, pode não valer a pena abstrair — dizer o porquê.
```

---

## Prompt para Melhorar Queries Eloquent

```
Você é o backend-agent + database-agent.

Refatorar as seguintes queries Eloquent para melhor performance e legibilidade:

[colar queries atuais]

Problemas identificados:
- [ ] N+1 queries
- [ ] SELECT * sem seleção de colunas
- [ ] Sem paginação em listagem
- [ ] Lógica de filtro repetida em múltiplos controllers

Melhorar:
1. Adicionar eager loading correto
2. Criar escopos locais para filtros reutilizáveis
3. Selecionar apenas colunas necessárias
4. Adicionar paginação onde necessário

Banco: PostgreSQL 15 — aproveitar recursos específicos se valer a pena.
Tabela com N registros estimados: [número].
```

---

## Regras do Refactoring Seguro

```
1. Escrever testes ANTES de refatorar (se não existirem)
2. Refatorar em passos pequenos — um commit por extração
3. Rodar tests a cada passo: php artisan test
4. NUNCA misturar refactoring com mudança de comportamento no mesmo commit
5. Se encontrar bug durante o refactor: documentar e corrigir em PR separado
6. Revisão mais cuidadosa que features novas — risco de regressão

Commit message padrão:
"refactor: extrair InvoiceService do InvoiceController

Sem mudança de comportamento. Apenas reorganização de responsabilidades.
Testes passando."
```
