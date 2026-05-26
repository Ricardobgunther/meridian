# Pull Request

## Resumo

<!-- Descreva em 1-3 frases o objetivo desta PR e o porquê da mudança. -->

## Mudanças principais

<!-- Liste as alterações relevantes (arquivos, módulos, endpoints, componentes). -->

-
-
-

## Como testar

- [ ] Subir o ambiente local (`make up`)
- [ ] Rodar migrations, se aplicável (`make artisan cmd="migrate"`)
- [ ] Passos manuais de verificação:
  1.
  2.
- [ ] Rodar a suíte de testes (`make test`)

## Checklist

- [ ] `review-agent` aprovou (sem itens `BLOQUEIO` pendentes)
- [ ] Testes passando localmente e no CI
- [ ] Migrations testadas (up e rollback), se houver
- [ ] Variáveis novas adicionadas ao `.env.example`
- [ ] Sem segredos commitados (`.env`, chaves, tokens)
- [ ] Documentação/`.ai/` atualizada quando o comportamento muda
