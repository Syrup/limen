# Limen: private access gateway

Technical reference for the setup in `~/.config/limen`. It covers the request path, the auth service internals, operational procedures, and the failure modes I have actually hit.

## Goal

Expose any local HTTP server through a stable public URL with one authentication gate in front of every port, using passkeys instead of a shared password.

Constraints that shaped the design:

- The host is a 4 GiB laptop, so the footprint matters.
- Only Cloudflare Tunnel is available for ingress, no port forwarding.
- The free Cloudflare certificate covers one subdomain level only.
- Dev servers bind to loopback, sometimes IPv6 only.

## Architecture

```
Browser
  |  HTTPS, certificate *.example.com
  v
Cloudflare edge (Universal SSL, proxied wildcard DNS)
  |  Worker "limen-host-filter" (route *.example.com/*)
  |  allowed hosts pass through, everything else 404 at the edge
  |  encrypted tunnel (QUIC)
  v
cloudflared (systemd --user, tunnel "<name>")
  |  HTTP to 127.0.0.1:8088
  v
Caddy container "limen" (network_mode: host, binds 127.0.0.1:8088)
  |-- host auth.example.com  -> reverse_proxy 127.0.0.1:8099
  `-- host p<port>.example.com
        |-- forward_auth -> 127.0.0.1:8099/verify (X-Port: <port>)
        `-- reverse_proxy localhost:<port>
  v
Bun container "limen-core" (binds 127.0.0.1:8099)
  |-- owner session (passkey, all ports)
  |-- guest session (access invite, scoped ports)
  |-- blocked ports, sessions, invites from SQLite
  `-- dashboard at /admin (owner only)
  v
Local app (Astro dev/preview, any HTTP server)
```

Two containers, one compose project, both on the host network namespace. Nothing listens on a public interface. Cloudflare is the only ingress.

## Configuration

Every value that differs between installs lives in `.env`, which Compose reads automatically. `.env` is gitignored; `.env.example` is the template.

```bash
cp .env.example .env
# edit the two required values, then start
docker compose up -d --build
```

| Variable | Default | What it controls |
|---|---|---|
| `LIMEN_DOMAIN` | required | The zone. Port hosts become `p<port>.<domain>` and cookies are scoped to `.<domain>`. |
| `LIMEN_AUTH_HOST` | required | Host that serves the login page and dashboard. Also the only accepted `Origin`. |
| `LIMEN_PROXY_PORT` | `8088` | Loopback port Caddy listens on. |
| `LIMEN_AUTH_PORT` | `8099` | Loopback port the auth service listens on. |
| `LIMEN_BIND` | `127.0.0.1` | Interface Caddy binds. |
| `LIMEN_SSH_PORT` | `22` | Port that cannot be blocked from the dashboard. |
| `LIMEN_OWNER_NAME` | `owner` | Name stored with the passkey. |
| `LIMEN_RP_NAME` | `Limen` | Relying party name in the passkey prompt. |
| `LIMEN_TZ` | `UTC` | Timezone for dates in the dashboard and invite pages. |
| `LIMEN_OWNER_TTL_HOURS` | `24` | Owner session lifetime. |
| `LIMEN_MAX_GUEST_SESSIONS` | `20` | Guest sessions kept per access invite. |
| `LIMEN_RATE_LIMIT_MAX` | `60` | Requests per minute per IP on the limited paths. |
| `LIMEN_AUDIT_RETENTION_DAYS` | `90` | Audit rows kept. |
| `LIMEN_MAX_COOKIE_AGE_DAYS` | `400` | Upper bound for the guest cookie. |
| `LIMEN_UID` / `LIMEN_GID` | `1000` | Ownership of `auth/data`. |

`auth/config.ts` reads these names. The domain and auth host are required: without them the service exits with code 78 instead of guessing, and Compose refuses to start. The Caddyfile uses the same variables.

## Files

```
~/.config/limen/
  .gitignore                # keeps runtime state, secrets, and keys out of git
  .env.example              # template for deployment values
  .env                      # local values, gitignored
  docker-compose.yml        # proxy + auth services
  Caddyfile                 # dispatcher rules, mounted read-only
  GUIDE.md                  # non-technical guide
  WORKFLOW.md               # this file
  auth/
    Dockerfile              # oven/bun:1-slim, production install, bundles the WebAuthn library
    .dockerignore           # keeps data/ and node_modules out of the build context
    package.json
    bun.lock
    tsconfig.json
    server.ts               # HTTP routes, sessions, WebAuthn, enforcement
    store.ts                # invites (HMAC), passkeys, ports, signing secret
    ui.ts                   # server-rendered auth pages and language strings
    admin.ts                # dashboard shell (htmx + Alpine)
    fragments.ts            # invite and port fragments for htmx
    invite.ts               # CLI for passkey and access invites
    passkey.ts              # CLI to list and remove registered passkeys
    config.ts               # every deployment value, read from the environment
    healthcheck.ts          # container health probe against /health
    server.test.ts          # HTTP tests against a temporary database
    store.test.ts           # invite, claim, session, and port tests
    assets/
      app.css               # built by Tailwind, do not edit by hand
      fonts.css             # Satoshi @font-face
      fonts/                # Satoshi variable WOFF2 and its license
      htmx.min.js           # vendored htmx 2.0.4
      alpine.min.js         # vendored Alpine 3.14
    data/
      auth.db               # SQLite: passkeys, invites, sessions, ports, audit
      invite-secret         # HMAC key for invite links (mode 600)
      legacy/               # JSON files moved here after the one-time import
  admin-ui/
    input.css               # Tailwind entry and theme tokens
    package.json            # build script
  backup/
    bin/gloak               # binary built from the local gloak source
    snapshot.ts             # VACUUM INTO plus integrity check
    verify-db.ts            # integrity check and table counts
    backup.sh               # snapshot, upload, check, verify, prune
    restore-drill.sh        # restore the newest snapshot and verify it
    alert.sh                # failure alert for systemd
    install.sh              # units, keygen, repo init, enable timer
    env.example             # configuration template
    systemd/                # user service, timer, alert unit
  worker/
    wrangler.toml           # name, entry, route *.example.com/*
    index.js                # host allowlist, 404 at the edge
    README.md               # deploy, verify, rollback
  errors/
    502.html                # Indonesian error page, served by Caddy
    502.en.html             # English error page
```

The `auth/data` directory is bind-mounted into the container, so it survives rebuilds.

`assets/webauthn.js` is not in the source tree. The image builds it from `@simplewebauthn/browser` during `docker compose build`, so the login page has no runtime dependency on a CDN.

## Request flow

### Unauthenticated request to a port host

1. Browser requests `https://p4323.example.com/`.
2. Cloudflare terminates TLS and forwards through the tunnel.
3. cloudflared matches ingress `*.example.com` and sends the request to `127.0.0.1:8088`.
4. Caddy extracts the port from the host with `map`. `p4323` becomes `4323`.
5. `forward_auth` calls `http://127.0.0.1:8099/verify`, forwarding the cookies, the `X-Forwarded-*` headers, and `X-Port` with the extracted port.
6. `/verify` checks the blocked-port list first, then the owner session, then the guest session. With no session it answers `302` to `https://auth.example.com/login?next=<original URL>`.
7. Caddy returns that redirect to the browser. The upstream app is never contacted.

### Login

1. `GET /` redirects to `/login`. `GET /login` returns the HTML page. If a valid session already exists and a `next` parameter is present, it redirects there; without `next` it shows a signed-in card with a logout button.
2. The page calls `POST /api/webauthn/login/options`. The server builds authentication options with `generateAuthenticationOptions`, stores the challenge in memory for 5 minutes, and returns `{options, challengeId}`.
3. The browser runs `startAuthentication` from `@simplewebauthn/browser` and gets an assertion from the authenticator.
4. The page posts `{challengeId, response, next}` to `/api/webauthn/login/verify`.
5. The server verifies the assertion with `verifyAuthenticationResponse`, using the stored public key and counter. On success it updates the counter, creates a session row in SQLite, and returns `Set-Cookie: ag_session=...`.
6. The page redirects to `next`, which must pass the `safeNext` check.

The login, registration, and invalid-invite pages share one dark layout defined in `server.ts`. Copy is written for the person using the gate, not for developers. The page shows the destination host taken from `next`, reports errors by name and recovery step, and marks the status region with `role="status"` so screen readers announce changes.

Language is resolved per request from `Accept-Language`. An `id*` tag wins if it ranks first, an `en*` tag wins if it ranks first, and Indonesian is the fallback when neither appears. There is no switcher and no language cookie. API error strings use the same header, so a failed request reports in the language of the page that made it.

### Authenticated request to a port host

1. Same path until `forward_auth`.
2. `/verify` reads `X-Port` and checks, in order: the port is not blocked, an owner session exists (allow everything), or a guest session exists whose scope covers the port. It answers `200` when allowed, `403` with a page when not, and `302` to login when there is no session at all.
3. Caddy proxies to `localhost:<port>` with `header_up Host localhost`.

The `Host` rewrite matters. Astro and Vite reject requests whose Host header is not in their allowlist, answering `403 Blocked request`. Rewriting to `localhost` avoids editing every project's Vite config. Apps that need the real host cannot be served through this dispatcher without changing that line.

### Invites

Two types share one store. Each invite has an `id`, a type, a label, a creation time, an expiry, a use counter, and an optional scope. Tokens are derived, not stored: the link token is `<id>.<HMAC-SHA256(secret, id)>`, and `invite-secret` holds the key. A stolen database without the secret file yields no usable invite link.

Passkey invite:

1. Operator creates it from the dashboard or with `docker compose exec auth bun run invite.ts`.
2. `GET /register?token=<token>` validates the signature, type, expiry, revocation, and use count.
3. `POST /api/webauthn/register/options?token=<token>` returns creation options. Existing credentials go into `excludeCredentials`.
4. The browser runs `startRegistration`, then posts the attestation to `/api/webauthn/register/verify` with the same token.
5. The server verifies, appends the credential, and increments the use counter. `maxUses` is 1.

Access invite:

1. Operator creates it with a duration and a scope of `all` or a list of ports.
2. `GET /access?token=<token>` validates it, consumes one use atomically, and creates a guest session in SQLite.
3. The guest session is stored in the `ag_access` cookie with `expires` equal to the invite expiry and `scope` copied from the invite.
4. The visitor is redirected to `next` when it is a port host inside the scope, to the single scoped port, or to `/access/granted`.
5. The link remains usable until revoked or expired. Revoking does not delete sessions already issued; they end at their expiry. Restarting auth clears them early.
6. Durations are capped at 365 days, minimum 1 minute. There is no forever option.

### Dashboard

`GET /admin` requires an owner passkey session. A request from a guest session gets a plain 404 so the path is not confirmed; only an unauthenticated request is redirected to the login page. The shell is rendered by `admin.ts` with Tailwind classes and loads vendored htmx and Alpine.

- `GET /fragments/invites` and `GET /fragments/ports` return server-rendered fragments for htmx.
- `POST /admin/invites` validates the form, creates an invite, and returns the invites fragment with an `HX-Trigger` toast.
- `POST /admin/invites/<id>/revoke` and `/delete` return the updated fragment.
- `POST /admin/ports` toggles a blocked port and returns the ports fragment.
- Every admin route checks the owner session and, for POST, the request origin.
- `ADMIN_DEV_OPEN=1` with `NODE_ENV` other than `production` bypasses the owner check for local UI testing. Production images set `NODE_ENV=production`, so the bypass is inert.

The dashboard CSS is built from `admin-ui/input.css`:

```bash
cd ~/.config/limen/admin-ui
npm run build
```

That writes `auth/assets/app.css`. Rebuild and restart the auth container after changing classes.

### Port filter

`store.ts` reads `/proc/net/tcp` and `/proc/net/tcp6` inside the container. Because the container uses host networking, those files list the host's listening sockets. Parsing takes microseconds; no port scan is performed.

The `blocked_ports` table stores the blocked list. `/verify` checks it before any session, so a blocked port is refused even with a valid guest or owner session. Ports 22, 8088, and 8099 are locked in the API to avoid cutting SSH, the proxy, or auth.

## WebAuthn parameters

| Setting | Value |
|---|---|
| Relying party ID | `example.com` |
| Relying party name | `LIMEN_RP_NAME`, default `Limen` |
| User name and display name | `LIMEN_OWNER_NAME` |
| Attestation | `none` |
| Resident key | `preferred` |
| User verification | `preferred` for options, required on verification |
| Challenge TTL | 5 minutes, in memory |
| Credential storage | `id`, base64url `publicKey`, `counter`, `transports`, `createdAt` |

The RP ID is the registrable domain, not the host, so one credential works on `auth.example.com` and on every `p<port>.example.com` origin. Origin checks accept only `https://auth.example.com`, the host that serves the ceremonies and the dashboard. A sibling `p<port>.example.com` origin is rejected, so a proxied app cannot borrow the owner session for a WebAuthn or admin request.

A signature counter that fails to increase on a credential which previously reported a non-zero counter fails the login and writes a `login_counter_regression` row to the audit table. Authenticators that always report 0 skip the check.

## Sessions and cookies

Two cookies, two kinds of session:

- `ag_session` is the owner session from a passkey login. Random 32 bytes. `Max-Age=86400`. It allows every port.
- `ag_access` is a guest session from an access invite. Its `Max-Age` follows the invite expiry, capped at 400 days by browser limits. It carries a scope of `all` or a port list.

Both use `Domain=.example.com`, `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Lax`. Sessions live in the `sessions` table, so they survive a restart until their expiry. The raw token is never stored, only its SHA-256 hash.

Keeping the guest cookie separate means redeeming an access link in the owner's browser does not downgrade or overwrite the owner session. `/verify` checks the owner session first.

Opening the same access link again in a browser that already holds a guest session for that invite reuses the session instead of writing another row. Each invite keeps at most 20 guest sessions; older rows are dropped when a new one arrives.

Logout deletes both session rows and clears both cookies. Revoking an access invite deletes the guest sessions issued from it. Removing a passkey deletes all owner sessions, so a lost device cannot keep using an old cookie.

The domain scope is what makes one login cover every port. The trade-off is that any app served under `*.example.com` shares the cookie namespace. `HttpOnly` keeps JavaScript from reading the session values, but a compromised app on the same site can still send requests to `auth.example.com` with the cookies attached. Admin writes now check the origin exactly, so those requests are rejected instead of merely unreadable. For a single-user homelab that is acceptable; for multi-tenant use it would not be.

## Caddyfile behavior

```caddyfile
:{$LIMEN_PROXY_PORT:8088} {
    bind {$LIMEN_BIND:127.0.0.1}

    map {http.request.host} {target_port} {
        ~^p(?P<pnum>[1-9][0-9]{0,4})\.{$LIMEN_DOMAIN}$ ${pnum}
        default none
    }

    @auth host {$LIMEN_AUTH_HOST}
    handle @auth {
        reverse_proxy localhost:{$LIMEN_AUTH_PORT:8099} { flush_interval -1 }
    }

    @invalid vars {target_port} none
    handle @invalid {
        respond "Subdomain tidak valid..." 404
    }

    handle {
        forward_auth localhost:{$LIMEN_AUTH_PORT:8099} {
            uri /verify
            header_up X-Port {target_port}
        }

        reverse_proxy localhost:{target_port} {
            header_up Host localhost
            flush_interval -1
        }
    }
}
```

Notes on the choices:

- `LIMEN_DOMAIN` and `LIMEN_AUTH_HOST` have no defaults on purpose. Compose refuses to start without them, so a missing value is an error instead of a proxy that quietly matches the wrong host.
- The domain lands inside a regex literally, so its dots match any character. A stray hostname never reaches Caddy because the tunnel ingress and the edge Worker both key on the real zone.
- `bind 127.0.0.1` keeps the listener off the LAN interface.
- `header_up X-Port` passes the extracted port to the auth service. Without it, `/verify` cannot apply per-port scopes or the blocked-port list.
- The invalid check sits in its own `handle` block. Caddy sorts `forward_auth` ahead of `respond` inside a single branch, so combining them makes junk hosts hit the login gate and return 302 instead of 404. Separate `handle` blocks are mutually exclusive and keep the check first.
- `reverse_proxy localhost:<port>` lets Go resolve `localhost` to both `127.0.0.1` and `::1`, so IPv4-only and IPv6-only backends both work. Listing two upstreams instead round-robins and fails half the time.
- `header_up Host localhost` satisfies Astro and Vite host checks.
- `flush_interval -1` disables response buffering, which keeps Vite HMR and SSE working.
- `map` output uses `${pnum}`. The capture name must not collide with built-in placeholders, so `port` is avoided.
- The port regex rejects leading zeros and caps at five digits. Ports above 65535 still match the pattern and fail upstream after login, which is harmless. That failure shows the same 503 page with the invalid port number.
- The `log` block uses a filter encoder that replaces the `token` query value with `REDACTED`. It covers `request>uri` and `request>headers>Referer`, because the register page links back to `/login` and that navigation carries the token. Invite links stay out of the logs while the log still shows that a token was used.

## Cloudflare and DNS

- Zone `example.com` is on Cloudflare nameservers.
- A proxied CNAME `*.example.com` points to `<tunnel-id>.cfargotunnel.com`.
- The tunnel config at `~/.cloudflared/config.yml` lists an ingress rule `*.example.com -> http://127.0.0.1:8088` before the `http_status:404` catch-all. Specific hostnames such as a separate SSH host stay on their own rules.
- Universal SSL issues `example.com` and `*.example.com`. A name like `4323.p.example.com` is two levels deep and has no certificate, so the TLS handshake fails. That is why the port pattern uses a prefix (`p4323`) instead of a nested label.
- `cloudflared` runs as a user unit: `~/.config/systemd/user/cloudflared.service`, enabled, with linger on.

## Edge host filter

The wildcard DNS record makes every `*.example.com` name resolve, junk included. Caddy answers 404 for those after the request crosses the tunnel. To stop them earlier, the Worker `limen-host-filter` runs on the route `*.example.com/*` and answers at the edge.

Allowlist:

- `example.com`
- `auth.example.com`
- `p<1-65535>.example.com`, regex `^p[1-9][0-9]{0,4}\.example\.com$`

Anything else gets `404` with body `Not found` and the header `x-host-filter: blocked`. Allowed requests are forwarded with `fetch(request)`.

Two properties make this safe:

- Same-zone subrequests from a Worker go to the zone origin, not back into the Worker, as long as the `global_fetch_strictly_public` compatibility flag stays off. It is off by default.
- Route patterns do not cover the apex. `example.com/*` needs its own route if the apex should also be filtered. The allowlist already permits it, so adding that route later does not break anything.

The Caddy regex stays in place as an independent check. If the Worker is deleted, filtering falls back to 404 from Caddy instead of failing open.

Why not WAF custom rules: regex operators require a Business plan or higher. Workers are free up to 100,000 requests per day.

Deployment and rollback live in `worker/README.md`.

## Error pages

When the dispatcher cannot reach an app, Caddy produces a 502. Cloudflare replaces origin 502 bodies with its own branded error page, and custom error pages are not available on the Free plan. The proxy therefore converts this failure to 503, a status Cloudflare passes through unchanged, and serves a page from `errors/`.

```caddyfile
handle_errors {
    @502 expression {http.error.status_code} == 502
    handle @502 {
        @en header_regexp Accept-Language (?i)^\s*en
        header Content-Type "text/html; charset=utf-8"
        templates { root /srv/errors }
        respond @en "{{include \"502.en.html\"}}" 503
        respond "{{include \"502.html\"}}" 503
    }
    respond "{http.error.status_code}" {http.error.status_code}
}
```

Details that matter:

- The status is 503 on purpose. A 502 body from the origin never reaches the browser because Cloudflare substitutes its own page. Verified by stopping the auth service and reading the public response.
- `templates` with `include` executes the file as a template, so `{{placeholder "target_port"}}` resolves from the `map` set earlier in the request.
- The port row is hidden when `target_port` is `none`, which is the case when the auth service itself is down.
- Language uses the same `Accept-Language` matcher as the rest of the site.
- The port value comes from the `[1-9][0-9]{0,4}` regex, so it is digits only and safe to render.
- Only proxy-level failures reach this block. A 404 from the invalid-host rule or a 403 from the auth service is a normal response and stays untouched.
- The page has a reload link that works without JavaScript. The inline handler only avoids adding a history entry.

## Security properties

What this setup does protect:

- Owner access requires a WebAuthn assertion bound to `example.com`. No shared password exists.
- Guest access is scoped: a guest session only passes `/verify` for the ports in its invite.
- Every port check happens in the auth service, before Caddy contacts the app. A blocked port or an out-of-scope port never reaches the upstream.
- Invite tokens are derived from a secret with HMAC-SHA256. The database stores no usable token, and the secret file is mode 600.
- Passkey invites are single-use. Access invites can be revoked, are capped at 365 days, and cannot be created forever.
- Cookies are `HttpOnly` and `Secure`, so network sniffing and most XSS paths cannot lift a session.
- The API, `/access`, and admin POSTs allow 60 requests per minute per client IP, keyed on `CF-Connecting-IP`. `/verify` is exempt because every proxied request calls it.
- `next` is validated against `https://*.example.com`, so the login page cannot be used as an open redirect.
- Admin writes require the owner session and an `Origin` of exactly `https://auth.example.com`. A request that sends neither `Origin` nor `Sec-Fetch-Site` is treated as a CLI client and allowed.
- The auth and proxy listeners bind loopback only. There is no LAN exposure.
- Auth pages send `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. Inline scripts run only when their SHA-256 hash matches, so an injected script does not execute. The dashboard also allows `'unsafe-eval'` because Alpine and htmx compile expressions at runtime.
- Attestation verification requires the user verification flag, so a bare presence tap is not enough.

What it does not protect against:

- Compromise of the Cloudflare account or the tunnel credentials means full takeover of the hostnames.
- Anyone who obtains a live access link can use it until it expires or is revoked. Treat the link as a secret.
- Anyone who obtains a live passkey link can register a passkey. Treat it as a secret and keep its duration short.
- Malware on a device with an unlocked authenticator can use the passkey while the device is unlocked.
- A stolen session cookie is valid until expiry; there is no per-session revocation list. Sessions live in SQLite, so deleting rows or removing a passkey is how you cut them short.
- Revoking an access invite does not invalidate sessions already issued; they end at their own expiry.
- The audit table records logins, invite changes, port changes, and access redemptions, but nothing reads it yet beyond manual SQL. Rows older than 90 days are pruned every ten minutes.
- The app behind a port is trusted. It shares the cookie namespace and can initiate same-site requests.
- `ADMIN_DEV_OPEN=1` disables the owner check. It is inert when `NODE_ENV=production`, which the image sets.

## Operations

### Start, stop, restart

```bash
cd ~/.config/limen
docker compose up -d              # start both
docker compose up -d --build auth # rebuild auth after code changes
docker compose restart proxy      # reload Caddyfile
docker compose down               # stop and remove containers
docker compose ps                 # status
```

Caddy mounts the Caddyfile read-only, so a config edit needs `docker compose restart proxy`, not `up` alone.

### Image pinning

Both base images are pinned by digest, in `auth/Dockerfile` and `docker-compose.yml`. To move to a newer base, bump the tag and the digest together:

```bash
docker pull oven/bun:1-slim
docker inspect --format '{{index .RepoDigests 0}}' oven/bun:1-slim
docker inspect --format '{{index .RepoDigests 0}}' caddy:2.11.4-alpine
```

A digest belongs to one architecture. Moving the stack to an arm host means new digests for both images.

### Tests

`cd auth && bun test` runs the HTTP and store tests against a temporary database on a spare port, so it never touches the live data. The suite covers the invite lifecycle, sessions, port scopes, the gate redirect, the security headers, and the rate limit. It needs the dependencies installed locally (`bun install`), not the running containers.

`cd worker && bun test` checks the edge host filter: the allowlist, the lookalike domains, and the fail-closed path when the deployment values are missing.

### Logs

```bash
docker compose logs -f --tail=100 proxy
docker compose logs -f --tail=100 auth
journalctl --user -u cloudflared -n 100 --no-pager
```

### Dashboard

Open `https://auth.example.com/admin` with an owner session. The page is server-rendered by `admin.ts` and loads fragments from `/fragments/*` through htmx. Alpine handles the type and scope toggles, copy feedback, two-step revoke and delete, and toasts.

The dashboard CSS is a Tailwind build, not hand-written CSS. After changing classes:

```bash
cd ~/.config/limen/admin-ui
npm run build
cd ..
docker compose up -d --build auth
```

The build needs `admin-ui/node_modules`, which is not copied into the image. Only `auth/assets/app.css` ships.

### Add a passkey

From the dashboard, create a `Passkey` invite. From the shell:

```bash
cd ~/.config/limen
docker compose exec auth bun run invite.ts
```

Open the printed URL on the target device. The default lifetime is 15 minutes and the link is single-use.

### Create a temporary access link

From the dashboard, create an `Akses sementara` invite with a duration and a scope. From the shell:

```bash
docker compose exec auth bun run invite.ts --type access --duration 2 --unit hours --scope 4322,4323
```

`--scope all` is the default. Durations are validated against 1 minute and 365 days.

### Revoke an access invite

Use the `Cabut` button in the dashboard. Revoking marks the invite dead and deletes guest sessions issued from it, so access ends immediately rather than at expiry. Expired invites can be deleted with `Hapus`.

### Revoke a passkey

List registered passkeys:

```bash
cd ~/.config/limen
docker compose exec auth bun run passkey.ts list
```

Remove one by id:

```bash
docker compose exec auth bun run passkey.ts remove <id>
```

Removing a passkey deletes every owner session, so all devices must sign in again with a remaining passkey. If you remove the last one, registration still requires a passkey invite, which cannot be created without an owner session. Create a spare passkey invite before removing the last credential.

### Database

SQLite runs in WAL mode with `synchronous=NORMAL`, `busy_timeout=5000`, and foreign keys on. Invite consumption is a single conditional update:

```sql
UPDATE invites
SET uses = uses + 1
WHERE id = ? AND revoked_at IS NULL AND expires_at > ?
  AND (max_uses IS NULL OR uses < max_uses)
```

Passkey registration uses a short claim (`claim_id`, 5 minute expiry) so two concurrent verifies cannot both consume a single-use invite. Sessions store `SHA-256(token)`, never the raw cookie value. Backups use `VACUUM INTO`, not a file copy, so WAL is checkpointed into a consistent snapshot.

The one-time migration imports the old JSON files and moves them to `auth/data/legacy/`. Keep that folder until you have verified the database.

### Backup and restore

Backups run through gloak from the local source tree. The pipeline is `VACUUM INTO` -> staging -> `gloak backup` -> `check` -> `verify` -> `prune`. A restore drill restores the newest snapshot and runs `PRAGMA integrity_check`.

Configuration lives in `backup/env` (mode 600, based on `backup/env.example`). Required values are `GLOAK_REMOTE`, `GLOAK_DIR`, `GLOAK_BIN`, `BUN_BIN`, `COMPOSE_DIR`, and `DB_PATH`. The remote is an rclone path such as `r2:limen-backup`.

Setup:

```bash
cd ~/.config/limen/backup
cp env.example env
chmod 600 env
# edit GLOAK_REMOTE and rclone config
./install.sh
```

`install.sh` links the systemd user units, generates the age key if missing, and initializes the repository. Enabling the timer is a separate decision; the units are linked but the timer stays off until `systemctl --user enable --now gloak-backup.timer`.

For Cloudflare R2 with a bucket-scoped token, the rclone remote needs `no_check_bucket = true`. Without it, `HeadBucket` is denied and rclone tries `CreateBucket`, which fails with 403:

```bash
rclone config update r2 no_check_bucket true
```

Two R2 compatibility fixes live in the local gloak source and in the binary under `backup/bin`:

- `isFileMode` validates a non-empty locator JSON. Rclone on R2 returns success with an empty body for a missing object, which previously made repo snapshots look like standalone file backups.
- `repo.Init` requires a non-empty `repo.json` before refusing to overwrite. The same empty-body behavior made a fresh bucket look initialized.

If you build from an older gloak checkout, initialize once with `--force` on a fresh bucket.

Manual run:

```bash
cd ~/.config/limen/backup
./backup.sh
./restore-drill.sh
./bin/gloak snapshots -R "$GLOAK_REMOTE"
```

Paths included in the backup:

```
auth/data/auth.db
auth/data/invite-secret
Caddyfile
docker-compose.yml
```

The gloak identity (`backup/keys/identity.txt`) is deliberately not inside the backup. Copy it to a password manager and one offline copy. Without it, no snapshot can be restored. The rclone config and Cloudflare tunnel credentials also stay outside the snapshot.

Restore procedure:

1. Stop auth: `docker compose stop auth`.
2. `cd backup && ./restore-drill.sh` to confirm the snapshot opens and passes integrity.
3. Restore to a real directory: `./bin/gloak restore <snapshot-id> -R "$GLOAK_REMOTE" -o /tmp/restore`.
4. Copy `auth.db` and `invite-secret` into `auth/data/`.
5. Start auth and check `/health`, then sign in.

The backup tool is alpha. Keep one independent copy (for example a weekly encrypted `rclone copy` of the snapshot) until gloak reaches beta.

### Change the domain

Passkeys are bound to the RP ID, which is `LIMEN_DOMAIN`. Moving to another domain invalidates all of them.

1. Set `LIMEN_DOMAIN` and `LIMEN_AUTH_HOST` in `.env`.
2. Update the tunnel ingress and the wildcard DNS record to the new zone.
3. Update `[vars]` and the route pattern in `worker/wrangler.toml`, then deploy the Worker.
4. `docker compose up -d --build`.
5. Remove every passkey with `bun run passkey.ts remove <id>` (or clear the `credentials` and `sessions` tables), then register fresh passkeys through an invite.

### Migrate to another host

1. Install Docker and the Cloudflare tunnel client.
2. Copy the project folder including `.env`, `auth/data/auth.db`, `auth/data/invite-secret`, `backup/env`, `backup/keys/`, and `~/.cloudflared` credentials.
3. Recreate the user systemd unit for cloudflared and the backup units.
4. `docker compose up -d --build`.
5. Confirm `cloudflared tunnel info <name>` shows connections.
6. Keep DNS unchanged; it points at the tunnel, not the host.

The compose file uses relative paths, so the project directory can live anywhere. Set `LIMEN_UID` and `LIMEN_GID` in `.env` to the user that owns `auth/data`.

## Verification matrix

Run these after any change.

| Check | Command | Expected |
|---|---|---|
| Auth health | `curl -s https://auth.example.com/health` | `{"ok":true}` |
| Register closed | `curl -s -o /dev/null -w "%{http_code}" https://auth.example.com/register` | `403` |
| Dashboard closed | `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://auth.example.com/admin` | `302` to `/login?next=%2Fadmin` |
| Fragments closed | `curl -s -o /dev/null -w "%{http_code}" https://auth.example.com/fragments/invites` | `404` |
| Login page | `curl -s -o /dev/null -w "%{http_code}" https://auth.example.com/login` | `200` |
| Passkey bundle | `curl -sI https://auth.example.com/assets/webauthn.js \| head -3` | `200`, `text/javascript` |
| No CDN import | `curl -s https://auth.example.com/login \| grep -c esm.sh` | `0` |
| Security headers | `curl -sD - -o /dev/null https://auth.example.com/login \| grep -i x-frame-options` | `x-frame-options: DENY` |
| Malformed cookie | `curl -s -o /dev/null -w "%{http_code}" -H 'Cookie: ag_session=%' https://auth.example.com/login` | `200` |
| Unit tests | `cd auth && bun test` | `21 pass, 0 fail` |
| Worker tests | `cd worker && bun test` | `4 pass, 0 fail` |
| Containers healthy | `docker compose ps` | both `healthy` |
| Gate redirect | `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://p4323.example.com/` | `302` to `https://auth.example.com/login?next=...` |
| Invalid host | `curl -s -o /dev/null -w "%{http_code}" https://asalan.example.com/` | `404` |
| Edge filter active | `curl -sI https://asalan.example.com/ \| grep -i x-host-filter` | `x-host-filter: blocked` |
| Non-numeric port host | `curl -s -o /dev/null -w "%{http_code}" https://pabc.example.com/` | `404` |
| Leading zero | `curl -s -o /dev/null -w "%{http_code}" https://p00.example.com/` | `404` |
| Dead port with session | browser check | `503` with the custom page and port |
| Loopback only | `ss -tln \| grep -E ':(8088\|8099)'` | both on `127.0.0.1` |
| Containers | `docker compose ps` | `limen` and `limen-core` up |
| Tunnel | `systemctl --user is-active cloudflared` | `active` |
| DNS | `dig +short acak.example.com @1.1.1.1` | two Cloudflare addresses |
| Database | `docker compose exec auth bun run passkey.ts list` | one passkey, no error |
| Backup | `cd backup && ./backup.sh` | snapshot id, check, verify, prune all succeed |
| Restore drill | `cd backup && ./restore-drill.sh` | `integrity: ok` and table counts |

The authenticated path needs a browser. A WebSocket upgrade check against the dev server should return `101 Switching Protocols` once a session cookie is present; without the cookie it returns `302` from the gate.

## Troubleshooting

| Symptom | Likely cause | Diagnosis | Fix |
|---|---|---|---|
| `503` from the proxy with a custom page | Backend not listening | Page shows the port, `ss -tln \| grep ':<port>'` | Start the app, or correct the port |
| `502` on auth host too | Auth container down or crashed | `docker compose logs --tail=50 auth` | Fix the error, `docker compose up -d auth` |
| `404 Subdomain tidak valid` | Host does not match `^p[1-9][0-9]{0,4}\.example\.com$` | Compare the URL | Use `p<port>.example.com`, one level deep |
| `403 Port ini tidak tersedia` | Port is blocked in the dashboard | `docker compose exec auth bun -e '...'` or check the dashboard | Toggle it back on in the `Port` panel |
| `403 Port ini di luar aksesmu` | Guest scope does not cover the port | Check the invite scope in the dashboard | Create a link with the right ports |
| `404` on `/fragments/*` | No owner session, or the session expired | Cookie `ag_session` missing | Sign in again, then reload the dashboard |
| Login loops | Cookie rejected | Browser devtools, Application, Cookies | Use `https`, allow cookies, clear site data |
| Redirect lands on `http://` | `X-Forwarded-Proto` from cloudflared is `http` | Inspect `Location` header | `reconstructNextUrl` forces `https`; keep it that way |
| Passkey prompt missing | No platform authenticator or unsupported browser | Try another browser | Set a screen lock or use a security key |
| `SecurityError` on ceremony | Origin or RP ID mismatch | Check the address bar | Access via `auth.example.com`, not an IP |
| `NotAllowedError` | User cancelled, or timeout | Browser console | Retry, keep the tab focused |
| `InvalidStateError` on registration | Credential already registered for this RP | `bun run passkey.ts list` | Expected; log in instead of registering |
| `403` on register | Missing, used, revoked, or expired invite | Check the dashboard or the `invites` table | Create a new passkey invite |
| `429` | Rate limit, 60 requests per minute per IP on `/api/*` | Auth logs | Wait 60 seconds |
| `1033` or `521`/`522` from Cloudflare | Tunnel disconnected | `systemctl --user status cloudflared` | Restart the unit, check outbound network |
| TLS handshake failure | Two-level hostname, or wildcard record missing | `openssl s_client -connect <host>:443 -servername <host>` | Use one-level names, restore the CNAME |
| 404 with body `Not found` | Worker rejected the host at the edge | `curl -sI https://<host>/ \| grep -i x-host-filter` shows `blocked` | Use `p<port>.example.com`, `auth.example.com`, or the apex |
| `403 Blocked request. This host is not allowed.` | Someone removed `header_up Host localhost` | Caddyfile | Restore the line |
| Login button inert | Passkey bundle missing from the image, or an extension blocks WebAuthn | Console shows a failed `/assets/webauthn.js` request | `docker compose up -d --build auth`, then try a clean profile |
| Auth loop after rebuild | Cookie rejected or clock skew | Browser devtools, `sessions` table | Clear site data, sign in again |
| Credentials unreadable after migration | UID mismatch on bind mount | `ls -ln auth/data` | Fix ownership, or adjust `user:` in compose |

## Known limitations

- One user account. Multi-user support would need a user store and per-user credentials.
- No passkey management page, no naming, no last-used timestamps.
- No session list or per-session revocation in the dashboard. Deleting rows from the `sessions` table is the blunt instrument.
- `/verify` has no rate limit because it runs on every request behind a port host. A flood there is bounded only by Cloudflare in front of it.
- The counter check only helps when the authenticator increments its signature counter.
- Sessions persist in SQLite; WebAuthn challenges remain in memory, so a restart during a ceremony means retrying login.
- SQLite has one writer. At this traffic level that is fine, but it rules out multiple auth replicas without moving to Postgres.
- The dispatcher only serves HTTP. TCP services such as databases need separate tunnel rules.
- The wildcard DNS record makes every `*.example.com` name resolve. The Worker blocks junk hosts at the edge and Caddy blocks them again, so no app is touched, but DNS still answers for names that serve nothing.
- The Worker route covers subdomains only. The apex is allowed by the allowlist but not yet routed through the filter.
- Compose healthchecks poll `/health` on auth and the proxy port. Docker marks a wedged container unhealthy but does not restart it on its own.
- Revoking an access invite deletes its guest sessions immediately. Removing a passkey deletes owner sessions.
- The backup tool is alpha. Keep an independent copy until it reaches beta.
- The dashboard is one owner. There is no multi-user support or roles, and the audit table has no screen of its own.
- `admin-ui` needs Node to rebuild the Tailwind CSS. The runtime does not.
- `ADMIN_DEV_OPEN` exists for local UI testing and is inert in production. Do not set `NODE_ENV` to anything other than `production` in the deployed image.

## Design notes

Basic Auth was the first version. It worked, but it sent the same credential to every port, had no logout, and could not be extended without sharing a password. The passkey gateway replaced it because the gate needs to be per-session, not per-request with a static secret.

A static setup token was the second version. It closed the bootstrap hole but stayed valid until changed, and it was awkward to type on a phone. Invites replaced it.

The invite system now has two shapes. Passkey invites stay single-use and short-lived. Access invites are reusable until revoked, carry a port scope, and cap at one year. Tokens are HMAC-derived from a secret, so the stored database holds no usable links while the dashboard can still rebuild them for copying.

The dashboard uses htmx and Alpine instead of a SPA. Fragments come from Bun, Tailwind builds the stylesheet, and Alpine handles local state. That keeps the runtime small and avoids a React bundle for one page. The trade-off is a build step for CSS and the need to rebuild after adding classes.

Typography is Satoshi, self-hosted as one 42 KB variable WOFF2. It is used on the auth pages and the dashboard; the 503 page keeps the system stack because it must render when auth or the app is unavailable. Font URLs carry a version query so a stale Cloudflare 404 cannot pin a missing file.

JSON files were the first store. They worked for one user, but read-modify-write lost updates under concurrent requests and a crash mid-write could corrupt a file. SQLite replaced them with WAL, transactions, and a single conditional update for invite consumption. Sessions moved into the database so a restart no longer signs everyone out.

gloak is the offsite layer because it is already being developed here, it encrypts before upload, and its repository mode gives deduplication, snapshots, retention, and verification. It is alpha, so the backup keeps an independent second copy until the format and locking settle.

Two containers beat one. Bundling Caddy and Bun into a single image would need a supervisor, mix logs, and make a single-service restart impossible. The compose file gives one command with two independent lifecycles at roughly 38 MB of RAM total.

The host filter started in Caddy alone. Adding a Worker at the edge means junk hostnames are rejected before they touch the tunnel, and it costs nothing on the free plan. Caddy keeps its own check so removing the Worker degrades to 404 instead of opening everything.

The port lives in the subdomain because the alternative, a path prefix, breaks apps that generate absolute asset URLs. A subdomain keeps the app at the root path, so nothing needs rewriting.
