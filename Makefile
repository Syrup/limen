.PHONY: up down logs test test-auth test-worker typecheck build-css invite backup restore-drill config

# Start everything and rebuild the auth image.
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

# Both suites. Neither touches the live database.
test: test-auth test-worker

test-auth:
	cd auth && bun test

test-worker:
	cd worker && bun test

typecheck:
	cd auth && bun run typecheck

# Rebuild the dashboard stylesheet into auth/assets/app.css.
build-css:
	cd admin-ui && npm run build

invite:
	docker compose exec auth bun run src/invite.ts

backup:
	cd backup && ./backup.sh

restore-drill:
	cd backup && ./restore-drill.sh

# Validate the compose file and the Caddyfile without restarting anything.
config:
	docker compose config --quiet
	docker compose exec -T proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
