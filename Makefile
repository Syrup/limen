.PHONY: up down logs test test-auth test-worker typecheck assets web-install invite backup restore-drill config

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

test: test-auth test-worker

test-auth:
	cd auth && bun test

test-worker:
	cd worker && bun test

typecheck:
	cd auth && bun run typecheck

assets:
	cd web && npm run build

web-install:
	cd web && npm ci

invite:
	docker compose exec auth bun run src/invite.ts

backup:
	cd backup && ./backup.sh

restore-drill:
	cd backup && ./restore-drill.sh

config:
	docker compose config --quiet
	docker compose exec -T proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
