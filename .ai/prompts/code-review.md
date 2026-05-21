# Prompt: Code Review

## Uso
Use para solicitar ao review-agent uma análise completa do código antes do merge.

---

## Prompt Completo

```
Você é o review-agent. Faça uma revisão completa do seguinte código/PR.

Contexto:
- Projeto: [nome] — [breve descrição do que o projeto faz]
- Stack: Laravel 11 + Next.js 14 + Supabase + Tailwind
- Esta PR: [o que foi implementado nesta PR em 1-2 frases]

Código para revisar:
[Colar o diff aqui, ou listar os arquivos modificados]

Revisar com foco em:

1. SEGURANÇA (bloquear se encontrar)
   - SQL injection, XSS, mass assignment
   - Autorização: toda ação tem verificação de ownership?
   - Rate limiting nos endpoints novos?
   - Dados sensíveis expostos em respostas ou logs?
   - IDOR: IDs validados contra o usuário autenticado?

2. PERFORMANCE
   - Queries N+1 (eager loading faltando?)
   - SELECT * sem colunas específicas?
   - Paginação em listagens?
   - Queries dentro de loops?
   - Índices necessários para as novas queries?

3. QUALIDADE
   - Funções com responsabilidade única?
   - Tratamento de erro nos pontos críticos?
   - TypeScript sem any?
   - Nomes descritivos (sem $data, $result, temp)?

4. TESTES
   - Casos de erro testados (não só happy path)?
   - Coverage não diminuiu?
   - Testes determinísticos (sem sleep, sem dependência de ordem)?

Formato de resposta:
- Listar BLOQUEIOS primeiro (críticos)
- Depois AVISOS (importantes mas não blockers)
- Depois SUGESTÕES (opcionais)
- Terminar com veredicto: APROVAR / APROVAR COM RESSALVAS / BLOQUEAR

Se não houver problemas: dizer "APROVADO — código limpo e seguro."
```

---

## Prompt Rápido (para revisões de baixo risco)

```
Você é o review-agent. Revisão rápida de segurança e N+1 em:

[arquivo ou diff]

Verificar apenas:
1. Autorização correta nos endpoints
2. Queries com eager loading adequado
3. Nenhum dado sensível na resposta

Resposta em até 10 linhas.
```

---

## Prompt para Revisão de Segurança Específica

```
Você é o review-agent com foco em segurança da API.

Analisar o controller [NomeController] e suas rotas associadas:

[colar código do controller + rotas]

Verificar contra OWASP Top 10:
- A01: Broken Access Control — todos os endpoints verificam ownership?
- A02: Cryptographic Failures — dados sensíveis protegidos?
- A03: Injection — inputs sanitizados e bindados?
- A04: Insecure Design — fluxo de negócio tem furos de lógica?
- A05: Security Misconfiguration — configurações seguras?
- A07: Auth Failures — autenticação obrigatória e válida?
- A08: Integrity Failures — verificação de integridade de dados externos?

Para cada vulnerabilidade encontrada:
- Indicar a linha exata
- Explicar o risco concreto
- Fornecer o código corrigido
```

---

## Prompt para Revisão de Performance

```
Você é o review-agent com foco em performance.

Analisar as seguintes queries e endpoints para problemas de performance:

[colar código]

Banco de dados: PostgreSQL via Supabase
ORM: Laravel Eloquent

Verificar:
1. N+1 queries em relacionamentos
2. SELECT sem limit em tabelas que podem crescer
3. Queries sem índice nas colunas de filtro
4. Agregações que poderiam ser cacheadas
5. Operações síncronas que deveriam ser assíncronas (jobs)

Para cada problema:
- Estimar o impacto (ex: "com 10.000 registros, executa X queries extras")
- Fornecer a versão otimizada
```

---

## Exemplos de Uso no Terminal

```bash
# Revisar arquivos específicos de um PR
git diff main...feature/invoice-comments -- \
  app/Http/Controllers/Api/V1/InvoiceCommentController.php \
  app/Services/InvoiceCommentService.php \
  | claude "Você é o review-agent. [prompt acima]"

# Revisar commit específico
git show abc1234 | claude "Você é o review-agent. [prompt de segurança]"

# Revisar apenas migrations
git diff main...feature/invoice-comments -- database/migrations/ \
  | claude "Você é o database-agent. Revisar esta migration para segurança, índices e reversibilidade."
```
