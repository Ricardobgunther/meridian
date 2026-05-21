# Skill: Docker Workflows

## Quando Usar
Em qualquer trabalho com Docker, docker-compose, CI/CD ou ambientes de desenvolvimento.

## Comandos do Dia a Dia

```bash
# Iniciar ambiente completo
make up
# ou
docker compose up -d

# Ver logs em tempo real
docker compose logs -f app
docker compose logs -f queue

# Executar comando no container PHP
docker compose exec app php artisan migrate
docker compose exec app php artisan tinker
docker compose exec app bash

# Rodar testes
docker compose exec app php artisan test --parallel
docker compose exec app php artisan test --filter=InvoiceTest

# Executar npm no container frontend
docker compose exec frontend npm run build
docker compose exec frontend npx vitest

# Reiniciar serviço específico
docker compose restart app
docker compose restart queue

# Rebuild sem cache (após alterar Dockerfile)
docker compose build --no-cache app
docker compose up -d --force-recreate app

# Ver status dos containers
docker compose ps

# Ver uso de recursos
docker stats
```

## Debugging de Container

```bash
# Inspecionar variáveis de ambiente injetadas
docker compose exec app env | grep APP_

# Verificar arquivo de configuração PHP
docker compose exec app php -i | grep -i opcache

# Testar conexão com banco
docker compose exec app php artisan db:show
docker compose exec app php artisan migrate:status

# Testar conexão Redis
docker compose exec redis redis-cli ping
docker compose exec app php artisan redis:ping-test

# Ver logs do Nginx
docker compose logs web --tail=50

# Shell no container Nginx
docker compose exec web sh

# Verificar se PHP-FPM está respondendo
docker compose exec app php-fpm -t
```

## Otimização de Imagem

```dockerfile
# Multi-stage build — princípios
# 1. Separar instalação de dependências do código
# 2. Usar imagens Alpine quando possível
# 3. Combinar RUN commands para reduzir layers
# 4. Copiar apenas o necessário para produção

# .dockerignore — crítico para build rápido
node_modules/
vendor/
.git/
.env
*.log
storage/logs/*
tests/
.github/
docker/
*.md
.cursor/
.ai/
```

## Docker Build Cache — Estratégia

```dockerfile
# CORRETO — aproveitar cache do Docker
# 1. Copiar apenas manifests primeiro (muda pouco)
COPY composer.json composer.lock ./
RUN composer install --no-dev

# 2. Depois copiar código (muda frequentemente)
COPY . .

# ERRADO — invalida cache a cada mudança de código
COPY . .
RUN composer install --no-dev
```

## Volumes — Dev vs Prod

```yaml
# Desenvolvimento: volume mount para hot reload
services:
  app:
    volumes:
      - .:/var/www/html              # código sincronizado do host
      - /var/www/html/vendor         # vendor separado (não sobrescrever)
      - /var/www/html/node_modules   # node_modules separado

# Produção: sem volumes de código (copiado no build)
services:
  app:
    image: meu-projeto:latest        # imagem com código dentro
    volumes:
      - storage-data:/var/www/html/storage  # apenas storage persistente
      - logs:/var/www/html/storage/logs
```

## Health Checks — Padrão

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "php", "-r", "echo 'ok';"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## PHP-FPM — Configuração de Performance

```ini
; docker/php/php-fpm.conf
[www]
pm = dynamic
pm.max_children      = 20
pm.start_servers     = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 10
pm.max_requests      = 500         ; reciclar worker após 500 requests

; Logging
access.log = /dev/stdout
error_log  = /dev/stderr
```

```ini
; docker/php/php.ini
memory_limit        = 256M
max_execution_time  = 60
upload_max_filesize = 20M
post_max_size       = 20M

; Opcache — essencial para performance
opcache.enable            = 1
opcache.memory_consumption = 256
opcache.max_accelerated_files = 10000
opcache.revalidate_freq   = 0      ; 0 em produção (não re-valida)
opcache.validate_timestamps = 0    ; 0 em produção
opcache.jit               = tracing
opcache.jit_buffer_size   = 100M
```

## Fluxo de Deploy com Docker

```bash
#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

REGISTRY="ghcr.io/meu-org/meu-projeto"
VERSION=$(git rev-parse --short HEAD)
IMAGE="${REGISTRY}:${VERSION}"

echo "==> Building image ${IMAGE}"
docker build \
  --file docker/php/Dockerfile \
  --target runtime \
  --tag "${IMAGE}" \
  --tag "${REGISTRY}:latest" \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg GIT_COMMIT="${VERSION}" \
  .

echo "==> Pushing to registry"
docker push "${IMAGE}"
docker push "${REGISTRY}:latest"

echo "==> Deploying to production"
ssh deploy@production "
  docker pull ${IMAGE}
  docker compose -f /app/docker-compose.prod.yml up -d --no-deps app
  docker compose -f /app/docker-compose.prod.yml exec -T app php artisan migrate --force
  docker compose -f /app/docker-compose.prod.yml exec -T app php artisan config:cache
  docker compose -f /app/docker-compose.prod.yml exec -T app php artisan route:cache
  docker compose -f /app/docker-compose.prod.yml exec -T app php artisan view:cache
  docker compose -f /app/docker-compose.prod.yml exec -T app php artisan queue:restart
"

echo "✓ Deploy ${VERSION} concluído"
```

## Rede entre Containers

```yaml
# Containers se comunicam pelo nome do serviço como hostname
services:
  app:
    # Conecta ao Redis usando hostname 'redis'
    environment:
      REDIS_HOST: redis        # não localhost!
      DB_HOST: db              # não localhost!

  redis:
    networks: [app-network]

  db:
    image: postgres:15-alpine
    networks: [app-network]

networks:
  app-network:
    driver: bridge
```

## Anti-Patterns
- Rodar como root em produção (`USER www-data` no Dockerfile)
- Secrets em variáveis de ambiente no Dockerfile (`ARG PASSWORD=...`)
- Volumes de código em produção
- `docker compose up` sem `-d` em scripts (fica preso)
- `latest` tag em produção (não é determinístico)
- Ignorar health checks — container "up" não significa "pronto"
- `CMD` vs `ENTRYPOINT` misturados sem propósito
