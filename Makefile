.PHONY: help install-ddcore ddcore-version docker-up docker-down docker-logs docker-status docker-psql types check i18n test migrate demo dev stop

ifneq (,$(wildcard .env))
    include .env
    export
endif

## the ddcore installed by install-ddcore.sh; override to test against another
## build, e.g. DDCORE=../ddcore/bin/ddcore make test
DDCORE ?= .ddcore/bin/ddcore

PORT ?= 8092
TEST_DSN ?= postgres://ddcore:ddcore@localhost:5457/demo_test?sslmode=disable

help: ## show this list of commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/ —/'

ddcore-version: ## show the ddcore version pinned in .ddcore-version
	@echo .ddcore-version: v$(shell cat .ddcore-version)
	@echo
	@echo $(DDCORE) version:
	@$(DDCORE) version

install-ddcore: ## download into .ddcore/bin the ddcore pinned in .ddcore-version
	./install-ddcore.sh

docker-up: ## start the app's Postgres
	docker compose up -d

docker-down: ## stop and remove the containers
	docker compose down

docker-logs: ## follow the Postgres logs
	docker compose logs -f

docker-status: ## show container state
	docker compose ps

docker-psql: ## open psql on the development database
	docker compose exec postgres psql -U ddcore -d demo_dev

types: ## generate DocType types and the embedded SDKs
	$(DDCORE) types

check: types ## install the compiler, typecheck and verify the translation catalogues
	npm ci --silent
	./node_modules/.bin/tsc --noEmit -p tsconfig.json
	$(DDCORE) i18n extract --all --lang pt-BR --check

i18n: ## rewrite translations/pt-BR.csv from the code
	$(DDCORE) i18n extract --all --lang pt-BR

test: check ## typecheck, then run the app's transactional tests
	DDCORE_DSN=$(TEST_DSN) $(DDCORE) test

migrate: ## apply migrations to the development database
	$(DDCORE) migrate

demo: ## create idempotent demonstration data
	$(DDCORE) demo

dev: ## start the server with hot reload on :8092
	$(DDCORE) dev

stop: ## stop whatever is listening on the app's port
	@PID=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$PID" ]; then kill "$$PID"; else echo "Nothing listening on port $(PORT)."; fi
