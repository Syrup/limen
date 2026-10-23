# Limen

Private access to local dev servers through one domain, with passkeys instead of a password.

Start a server on port 4323, open `https://p4323.example.com`, and you land on it. Everything behind the domain needs a passkey. Invite links can grant temporary, port-scoped access without handing out a credential.

## How it works

```
browser -> Cloudflare (edge host filter) -> tunnel -> Caddy -> auth gate -> your app
```

- Caddy maps `p<port>.<domain>` to `localhost:<port>` after asking the auth service for permission.
- The auth service is a Bun app with SQLite for passkeys, invites, sessions, blocked ports, and an audit log.
- Passkeys are bound to the zone, so one credential works on every port host.
- Guests get a scoped session from an invite link. The owner gets a session from a passkey and reaches every port.
- A Cloudflare Worker rejects hostnames that do not follow the scheme before they reach the tunnel.

Only the auth host and the port hosts answer. The SSH port, the proxy port, and the auth port cannot be blocked from the dashboard.

## Requirements

- Docker with Compose.
- A Cloudflare zone with a tunnel, wildcard DNS (`*.example.com`), and a wildcard certificate.
- A browser with passkey support and a device with a screen lock.
- [`gloak`](https://github.com/StackNadi/gloak) if you want offsite backups. It is a separate MIT tool in Go; build it from its own source and place the binary where `GLOAK_BIN` points.

## Quick start

```bash
git clone <repo> limen
cd limen
cp .env.example .env
$EDITOR .env          # set LIMEN_DOMAIN and LIMEN_AUTH_HOST
docker compose up -d --build
```

Check the service:

```bash
curl -s https://auth.example.com/health   # {"ok":true}
```

With no passkey registered yet, create the first invite from the shell:

```bash
docker compose exec auth bun run invite.ts
```

Open the printed link, approve the passkey prompt, then use the dashboard at `https://auth.example.com/admin`.

## Configuration

Everything that differs between installs lives in `.env`. The full table is in [WORKFLOW.md](WORKFLOW.md#configuration). Two values are required, and Compose refuses to start without them:

| Variable | Example |
|---|---|
| `LIMEN_DOMAIN` | `example.com` |
| `LIMEN_AUTH_HOST` | `auth.example.com` |

Missing values stop the auth service with exit code 78 instead of falling back to a default.

## Tests

```bash
cd auth && bun install && bun test   # 21 tests
cd worker && bun test                # 4 tests
```

Both suites use temporary state and never touch a running deployment.

## Status

Built for a single owner on one host. There is no multi-user store, no session list in the dashboard, and SQLite allows one writer. It runs daily here, but treat it as a homelab tool, not a multi-tenant service.

## Docs

- [GUIDE.md](GUIDE.md): day to day use, written for someone who just wants to open a dev server.
- [WORKFLOW.md](WORKFLOW.md): request path, security properties, operations, backup and restore, failure modes.
- [worker/README.md](worker/README.md): deploying and rolling back the edge filter.

## Security

The threat model, and the parts this does not protect against, are in [WORKFLOW.md](WORKFLOW.md#security-properties). The short version: passkeys are bound to the zone, session cookies are `HttpOnly` and scoped to the zone, invite tokens are HMAC-derived and redacted from logs, and the gate runs before the proxy contacts your app.

## License

MIT. See [LICENSE](LICENSE).
