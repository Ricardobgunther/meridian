# Makefile — atalhos de desenvolvimento do Projeto1.
#
# A aplicação roda no HOST: o backend Laravel via `composer dev` (server +
# queue:listen + logs + vite) e o frontend Next via `npm run dev`. O
# docker-compose sobe apenas serviços auxiliares (Mailpit) — ainda não há
# Dockerfile/container da app, então não existe alvo `shell` para um container
# PHP. Quando a app for containerizada, adicionar `shell`/`build` aqui.

BACKEND  := backend
FRONTEND := frontend

.DEFAULT_GOAL := help
.PHONY: help up down dev dev-frontend artisan migrate fresh \
        test test-backend test-frontend lint

help: ## Lista os alvos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Sobe os serviços auxiliares (Mailpit) em background
	docker compose up -d

down: ## Para os serviços auxiliares
	docker compose down

dev: ## Roda o backend no host (server + queue + logs + vite)
	cd $(BACKEND) && composer dev

dev-frontend: ## Roda o frontend Next no host
	cd $(FRONTEND) && npm run dev

artisan: ## Executa um comando artisan — uso: make artisan cmd="migrate"
	cd $(BACKEND) && php artisan $(cmd)

migrate: ## Roda as migrations pendentes
	cd $(BACKEND) && php artisan migrate

fresh: ## Recria o schema do zero e roda os seeders
	cd $(BACKEND) && php artisan migrate:fresh --seed

test: test-backend test-frontend ## Roda TODA a suíte (backend + frontend)

test-backend: ## Pest (backend)
	cd $(BACKEND) && ./vendor/bin/pest

test-frontend: ## Vitest em modo run (frontend)
	cd $(FRONTEND) && npm run test:run

lint: ## ESLint (frontend) + Pint (backend)
	cd $(FRONTEND) && npm run lint
	cd $(BACKEND) && ./vendor/bin/pint --test
