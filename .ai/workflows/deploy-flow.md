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
