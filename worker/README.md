# Worker: edge host filter

Blocks hostnames that do not match the port pattern before they reach the tunnel. Mirrors the Caddy rule in `../Caddyfile`.

## What it does

Allowed hostnames, read from `LIMEN_DOMAIN` and `LIMEN_AUTH_HOST` in `wrangler.toml`, are forwarded to the origin through `fetch(request)`:

- `example.com`
- `auth.example.com`
- `p<1-65535>.example.com` with no leading zero and at most five digits

Everything else gets a plain `404` with the header `x-host-filter: blocked`, generated at the Cloudflare edge. The tunnel and Caddy never see it.

Caddy still validates the port independently. The Worker is a second fence, not a replacement.

## Deploy

Edit `[vars]` and the route pattern in `wrangler.toml` first. The template ships `example.com`, and deploying it unchanged makes every request to your zone return 404. That is the safe failure, but it is still an outage.

Run the tests before deploying. They do not need Cloudflare credentials:

```bash
cd worker && bun test
```

The Worker needs an API token with these zone permissions on your zone:

- Workers Scripts: Edit
- Workers Routes: Edit
- Zone: Read

Run from this directory:

```bash
export CLOUDFLARE_API_TOKEN="<token>"
export CLOUDFLARE_ACCOUNT_ID="<account id>"
npx wrangler@latest deploy
```

Alternatively, paste `index.js` into the dashboard: Workers and Pages, Create, Worker, Deploy, then add a route `*.example.com/*` under Settings, Triggers.

The route wildcard covers subdomains only. The apex needs its own route `example.com/*` if it should also be filtered. The allowlist already includes it, so adding that route later is safe.

## Why `fetch(request)` does not loop

Cloudflare routes same-zone subrequests to the zone origin, ignoring Workers mapped to the URL, as long as the `global_fetch_strictly_public` compatibility flag stays off. It is off by default. Do not enable that flag for this Worker.

## Verify after deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://asalan.example.com/   # 404, body "Not found"
curl -s -o /dev/null -w "%{http_code}\n" https://pabc.example.com/     # 404, body "Not found"
curl -s -o /dev/null -w "%{http_code}\n" https://p00.example.com/      # 404, body "Not found"
curl -s -o /dev/null -w "%{http_code}\n" https://p4323.example.com/    # 302 to auth login
curl -s https://auth.example.com/health                                # {"ok":true}
```

To prove the Worker answered and not Caddy, check the header:

```bash
curl -sI https://asalan.example.com/ | grep -i x-host-filter
```

A `blocked` value means the request stopped at the edge. No header means it reached Caddy, which also returns 404 for the same host. Compare the body: Caddy sends `Subdomain tidak valid...`, the Worker sends `Not found`.

WebSocket passthrough matters for Vite HMR. After deploy, open the dev server through a port host and confirm hot reload still works. The upgrade request should pass through the Worker unchanged.

## Rollback

```bash
npx wrangler@latest delete --name limen-host-filter
```

Or remove the route in the dashboard. The site returns to Caddy-only filtering immediately.

## Limits

Free plan: 100,000 requests per day, 10 ms CPU per request. This Worker does a regex test and a pass-through fetch, so it stays far under both.
