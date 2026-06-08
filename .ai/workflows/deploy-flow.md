# Workflow: Deploy Flow

## Visão Geral
Processo de deploy zero-downtime do ambiente de staging até produção.

## Ambientes

```
Local → Staging → Produção
  ↓         ↓          ↓
Dev       Automático  Manual
branch    (main)      (tag)
```

---

## Fase 1 — Staging (automático)

### Trigger
Qualquer push na branch `main` após merge de PR aprovado.

### Pipeline CI/CD
```yaml
# .github/workflows/staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Run full test suite
        run: |
          docker compose -f docker-compose.ci.yml up -d
          docker compose -f docker-compose.ci.yml exec -T app \
            php artisan test --parallel --coverage-min=80

      - name: Build Docker image
        run: |
          IMAGE="ghcr.io/${{ github.repository }}:staging-${{ github.sha }}"
          docker build --target runtime -t "$IMAGE" .
          docker push "$IMAGE"

      - name: Deploy to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          key:  ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /app
            export IMAGE_TAG="staging-${{ github.sha }}"
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --no-deps app
            docker compose -f docker-compose.prod.yml exec -T app \
              php artisan migrate --force
            docker compose -f docker-compose.prod.yml exec -T app \
              php artisan config:cache
            docker compose -f docker-compose.prod.yml exec -T app \
              php artisan route:cache
            docker compose -f docker-compose.prod.yml exec -T app \
              php artisan queue:restart

      - name: Smoke tests
        run: |
          sleep 15  # aguardar containers subirem
          curl -f https://staging.meu-projeto.com/api/health || exit 1
          curl -f https://staging.meu-projeto.com/api/v1/ping || exit 1
```

### Health Check Endpoint
```php
// routes/api.php
Route::get('/health', function () {
    return response()->json([
        'status'    => 'ok',
        'timestamp' => now()->toISOString(),
        'version'   => config('app.version'),
        'database'  => DB::connection()->getPdo() ? 'ok' : 'error',
        'cache'     => Cache::store('redis')->ping() ? 'ok' : 'error',
    ]);
});
```

---

## Fase 2 — Verificação em Staging

**Responsável: desenvolvedor que fez o merge**

### Checklist de Staging
```
□ Health check respondendo: GET /api/health → 200 OK
□ Features novas funcionando conforme especificação
□ Features existentes não foram quebradas (smoke test manual)
□ Logs sem novos erros: tail -f /app/storage/logs/laravel.log
□ Logs de acesso NÃO vazam o token de convite: paths /api/v1/invitations/accept/*
  e /invite/* aparecem redigidos no proxy/APM (ver "Observabilidade e Segredos
  em Logs", R10)
□ Migrations aplicadas corretamente: php artisan migrate:status
□ Performance aceitável: nenhuma rota > 1s em P99
```

### Comandos de Verificação
```bash
# Verificar logs em staging
ssh deploy@staging "docker compose logs -f app --tail=100"

# Status das migrations
ssh deploy@staging "docker compose exec app php artisan migrate:status"

# Testar endpoint específico
curl -H "Authorization: Bearer $STAGING_TOKEN" \
  https://staging.meu-projeto.com/api/v1/invoices | jq '.meta'

# Ver jobs na fila
ssh deploy@staging "docker compose exec app php artisan horizon:status"
```

---

## Fase 3 — Deploy em Produção

### Pré-requisitos
```
✓ Staging verificado e aprovado
✓ Hora adequada (evitar peak: 9h-11h e 14h-17h)
✓ Time notificado: "Iniciando deploy às HH:MM"
✓ Rollback plan definido
✓ Nenhuma migration destrutiva sem coordenação
```

### Estratégia de Deploy Zero-Downtime

```bash
#!/bin/bash
# scripts/deploy-prod.sh
set -euo pipefail

VERSION=$(git rev-parse --short HEAD)
IMAGE="ghcr.io/meu-org/meu-projeto:${VERSION}"

echo "=== Deploy ${VERSION} para produção ==="
echo "Horário: $(date)"

# 1. Pull da imagem já testada em staging
docker pull "${IMAGE}"

# 2. Migrations (Laravel espera conexões existentes terminarem)
echo "→ Aplicando migrations..."
docker compose -f docker-compose.prod.yml run --rm \
  -e APP_ENV=production \
  app php artisan migrate --force

# 3. Trocar containers gradualmente (se usar multiple replicas)
echo "→ Atualizando containers..."
docker compose -f docker-compose.prod.yml up -d \
  --no-deps \
  --scale app=2 \
  app

# Aguardar health check dos novos containers
sleep 20
docker compose -f docker-compose.prod.yml exec app \
  php -r "echo 'Container saudável';"

# 4. Escalar de volta e remover containers antigos
docker compose -f docker-compose.prod.yml up -d \
  --no-deps \
  --scale app=1 \
  app

# 5. Cache de configuração/rotas
echo "→ Otimizando Laravel..."
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan config:cache
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan route:cache
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan view:cache

# 6. Reiniciar queue workers graciosamente
echo "→ Reiniciando queue workers..."
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan queue:restart

echo "✓ Deploy ${VERSION} concluído em $(date)"
```

### Verificação Pós-Deploy
```bash
# 1. Health check imediato
curl -f https://meu-projeto.com/api/health

# 2. Verificar logs por 5 minutos
ssh deploy@prod "docker compose logs -f app --tail=50"

# 3. Verificar métricas (response time, error rate)
# — Acessar dashboard de monitoramento

# 4. Testar fluxo crítico manualmente (criar invoice, etc.)
```

---

## Filas e Queue Worker

Alguns fluxos despacham trabalho assíncrono — notadamente o **email de convite**,
que é enfileirado e despachado **after-commit** (`InvitationMail` é `ShouldQueue`,
follow-up R11). O job só vira email se um **worker estiver rodando**; sem worker, a
linha fica parada na tabela `jobs` e o convidado nunca recebe o link.

### Requisito (inegociável em produção)
Manter ao menos um `php artisan queue:work` como **processo supervisionado**
(supervisor/systemd/container dedicado) — não um one-shot. O passo 6 do deploy
(`php artisan queue:restart`) apenas sinaliza os workers existentes para
reiniciarem e pegarem o código novo; ele **não cria** um worker.

```bash
# Exemplo de programa supervisor (produção)
# [program:projeto1-queue]
# command=php /app/artisan queue:work --tries=3 --max-time=3600 --sleep=3
# autostart=true   autorestart=true   numprocs=1
# stopwaitsecs=3600   # deixa o job em andamento terminar no deploy
```

- **Local:** `composer dev` (em `backend/`) já roda `php artisan queue:listen`
  junto com server/vite/logs — nenhum setup extra.
- **`QUEUE_CONNECTION`:** `database` por padrão (tabela `jobs`); a stack prevê
  Redis em produção. O worker é o mesmo comando em qualquer driver.
- **Falhas:** jobs que esgotam `--tries` caem em `failed_jobs`. Monitorar e
  reprocessar com `php artisan queue:retry`. O payload do `InvitationMail` é
  **encriptado** em repouso (`ShouldBeEncrypted`), então o token raw não fica em
  claro nessa tabela.

### Verificação pós-deploy
```bash
# Worker vivo e consumindo?
ssh deploy@prod "docker compose exec app php artisan queue:monitor default"
# Jobs falhados acumulando?
ssh deploy@prod "docker compose exec app php artisan queue:failed"
```

---

## Rollback

### Quando Fazer Rollback
- Error rate > 1% dos requests nas primeiras 15 minutos
- Qualquer endpoint crítico com erro 500
- Migration causou problema de integridade de dados

### Procedimento de Rollback
```bash
# 1. Identificar versão anterior
git log --oneline -10
PREVIOUS_VERSION="abc1234"  # hash do commit anterior

# 2. Reverter containers para imagem anterior
docker pull "ghcr.io/meu-org/meu-projeto:${PREVIOUS_VERSION}"
docker compose -f docker-compose.prod.yml up -d \
  --no-deps app \
  # usar imagem anterior

# 3. Reverter migration (se seguro)
# CUIDADO: só reverter se não há dados na nova coluna/tabela
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan migrate:rollback --step=1

# 4. Limpar cache
docker compose -f docker-compose.prod.yml exec -T app \
  php artisan optimize:clear

# 5. Notificar time
echo "ROLLBACK executado para versão ${PREVIOUS_VERSION}"
```

### Mitigação — Feature Flags
Para features de risco, usar feature flags em vez de rollback:

```php
// config/features.php
return [
    'new_invoice_pdf_engine' => env('FEATURE_NEW_PDF_ENGINE', false),
];

// Uso no código
if (config('features.new_invoice_pdf_engine')) {
    return app(NewPdfEngine::class)->generate($invoice);
}
return app(LegacyPdfEngine::class)->generate($invoice);

// Para desabilitar em produção sem deploy:
// Mudar variável de ambiente e reiniciar containers
```

---

## Observabilidade e Segredos em Logs (R10)

> **Inegociável em produção.** O token de convite trafega **no path da URL** e
> **é a credencial** — quem tem o token raw aceita o convite. Diferente de um
> `Authorization: Bearer`, um path-param é capturado por padrão em praticamente
> todo log de acesso e ferramenta de APM. Antes de habilitar qualquer logging de
> acesso em produção, garanta que estes paths sejam **redigidos** (preferível) ou
> **não logados**:
>
> - `GET|POST /api/v1/invitations/accept/{token}` e `.../{token}/decline` — backend
> - `/invite/{token}` — página do frontend (Next.js); o servidor ainda faz fetch
>   server-side para o endpoint acima, então o token vaza nas duas camadas
>
> **Aplique a redação em TODO proxy/gateway no caminho — não só num.** A perna
> SSR resolve o backend via env (`NEXT_PUBLIC_API_URL` / `API_BASE_URL`, ver
> `frontend/lib/api/client.ts`); se em produção ela bate direto no upstream do
> backend, o `map` configurado só no edge do frontend **não** cobre o access_log
> desse upstream. Redija no proxy do frontend **e** no(s) proxy(ies) do backend,
> além de qualquer CDN/WAF/API gateway na frente (Cloudflare, etc.).

### Onde o token vaza
| Camada | Como vaza | Mitigação |
|--------|-----------|-----------|
| Nginx / proxy / LB (frontend **e** backend) | `$request_uri` no `access_log` | redigir o segmento do token (map abaixo), em **todos** os proxies do caminho |
| CDN / WAF / API gateway (Cloudflare, etc.) | captura do path nos logs de borda | mesma regra de redação/scrubbing por path no provedor |
| Next.js runtime | logs de acesso/SSR que registram a URL | redigir/excluir os paths `/invite/*` |
| **`Referer` header** | a página `/invite/<token>` carrega no browser com o token no path; qualquer recurso de origem externa (analytics, fonte, pixel) ou link clicado recebe `/invite/<token>` no `Referer` → vaza para terceiros e logs deles | ✅ **já mitigado**: `Referrer-Policy: no-referrer` em `/invite/*` via `frontend/next.config.mjs` (testado em `next.config.test.ts`) |
| APM / observabilidade (Sentry, Datadog, etc.) | captura de URL completa em traces/breadcrumbs | regra de scrubbing por prefixo de path |
| Logs de Auth (Supabase/PostgREST) | o POST `accept/{token}` passa pelo Supabase; access logs do PostgREST/gateway capturam o path | aplicar redação/scrubbing onde esses logs forem coletados |
| `laravel.log` | **não** loga o path por padrão — só vaza se você logar `$request->fullUrl()` | nunca logar a URL completa de rotas accept-by-token |

> ⚠️ A redação cobre o **path**. Não reintroduza o vazamento por outra via:
> `$http_authorization` em qualquer `log_format` captura o Bearer — mantenha fora.
> `$http_referer` só é seguro porque enforçamos `Referrer-Policy: no-referrer` em
> `/invite/*` (ver linha da tabela); sem essa policy, ele volta a logar o token.

### Redação no Nginx (recomendado — preserva o resto da linha de log)
```nginx
# Substitui o token por [REDACTED] mantendo o restante do path/query visível.
# Use $loggable_uri no lugar de $request no log_format.
map $request_uri $loggable_uri {
    ~^(?<p>/api/v1/invitations/accept/)[^/?]+(?<s>.*)$  "${p}[REDACTED]${s}";
    ~^(?<p2>/invite/)[^/?]+(?<s2>.*)$                   "${p2}[REDACTED]${s2}";
    default                                              $request_uri;
}

log_format redacted '$remote_addr - $remote_user [$time_local] '
                    '"$request_method $loggable_uri $server_protocol" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent"';

access_log /var/log/nginx/access.log redacted;
```

Alternativa mais simples (perde a linha inteira desses paths):
```nginx
location ~ ^/(api/v1/invitations/accept|invite)/ {
    access_log off;
    # ... proxy_pass etc.
}
```
> Trade-off: `access_log off` **cega a detecção de abuso** desses endpoints —
> o GET público de preview tem `throttle:60,1` e você perde a trilha para
> investigar brute-force/enumeração. Prefira o `map` (redige o token, mantém a
> linha) sempre que possível.

> O `log_format redacted` acima mantém `$http_referer` por ser útil em analytics;
> isso só é seguro porque enforçamos `Referrer-Policy: no-referrer` em `/invite/*`
> (já implementado em `frontend/next.config.mjs`), que impede o browser de enviar
> `/invite/<token>` no Referer. Se remover essa policy, tire `$http_referer` do
> formato. **Nunca** inclua `$http_authorization` em log_format algum.

### APM / observabilidade
Configurar **URL scrubbing** para mascarar o segmento após `/accept/` e `/invite/`
antes do envio. Exemplo conceitual (Sentry `beforeSend`): reescrever
`event.request.url` aplicando a mesma regex de redação acima.

### Solução durável (R10 longo prazo — fora deste escopo)
Mover o token do path para um header (`X-Invitation-Token`). Headers não entram
em access logs por padrão, eliminando a classe inteira de vazamento. É **mudança
contratual** (backend + frontend) e está rastreada separadamente; enquanto não
acontece, a redação acima é a defesa obrigatória.

---

## Comunicação de Deploy

### Antes
```
"🚀 Deploy iniciando às 15:30 — versão abc1234
Inclui: feature de exportação PDF, fix de N+1 em listagem
Staging verificado ✓
Estimativa: 5-10 minutos"
```

### Após Sucesso
```
"✅ Deploy abc1234 concluído às 15:37
Todos os health checks passando
Logs limpos — nenhum erro novo"
```

### Em Caso de Problema
```
"⚠️ Deploy abc1234 apresentou problemas
Error rate subiu para 3% nos últimos 2 minutos
Iniciando rollback para abc1233
ETA para estabilização: 5 minutos"
```
