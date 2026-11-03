.PHONY: setup dev dev-all build test test-integration test-e2e lint typecheck format clean docker-up docker-down help

# --- Setup ---------------------------------------------------------------------
setup: ## Install dependencies and copy env examples
	pnpm install
	@for f in apps/api apps/web apps/mock-idp apps/mock-webhook; do \
		if [ -f $$f/.env.example ] && [ ! -f $$f/.env ]; then \
			cp $$f/.env.example $$f/.env; \
			echo "Created $$f/.env"; \
		fi; \
	done
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env"; fi

# --- Development ---------------------------------------------------------------
dev: ## Start all services in development mode
	pnpm dev

dev-all: ## Start infra containers + all services
	pnpm dev:all

# --- Build ---------------------------------------------------------------------
build: ## Build all packages
	pnpm build

# --- Testing -------------------------------------------------------------------
test: ## Run unit tests
	pnpm test

test-integration: ## Run integration tests (requires PostgreSQL)
	pnpm test:integration

test-e2e: ## Run Playwright end-to-end tests
	pnpm test:e2e

# --- Code Quality --------------------------------------------------------------
lint: ## Run ESLint
	pnpm lint

lint-fix: ## Run ESLint with auto-fix
	pnpm lint:fix

typecheck: ## Run TypeScript type checking
	pnpm typecheck

format: ## Format all files with Prettier
	pnpm format

format-check: ## Check formatting without modifying
	pnpm format:check

# --- Docker --------------------------------------------------------------------
docker-up: ## Start Docker Compose stack
	docker compose -f infra/docker-compose.yml up -d

docker-down: ## Stop Docker Compose stack
	docker compose -f infra/docker-compose.yml down

docker-reset: ## Stop stack and remove volumes (WARNING: destroys data)
	docker compose -f infra/docker-compose.yml down -v

docker-logs: ## Tail logs from all services
	docker compose -f infra/docker-compose.yml logs -f

# --- Cleanup -------------------------------------------------------------------
clean: ## Clean all build artifacts
	pnpm clean

# --- Help ----------------------------------------------------------------------
help: ## Show this help message
	@grep -E '"'"'^[a-zA-Z_-]+:.*?## .*$$'"'"' $(MAKEFILE_LIST) | sort | awk '"'"'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'"'"'

.DEFAULT_GOAL := help
