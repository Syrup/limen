# Cloudflare setup

Limen needs a tunnel, a wildcard DNS record, and a small Worker.

## 1. Tunnel

Follow [Create a locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/). You need `cloudflared tunnel login` and `cloudflared tunnel create limen` from that page.

The Limen-specific part is the ingress, in `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: "*.example.com"
    service: http://127.0.0.1:8088
  - service: http_status:404
```

The wildcard rule comes before the catch-all, and it covers subdomains only. Limen serves `auth.example.com` and `p<port>.example.com`, so the apex is not needed.

To start it at boot, follow [Run as a service on Linux](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/). If you use a user unit instead of the system service, run `loginctl enable-linger "$USER"` so it starts without a login.

## 2. DNS

Follow [DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/). Limen needs one wildcard record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `*` | `<tunnel-id>.cfargotunnel.com` | Proxied |

Every port gets its own name, so a wildcard is the whole point. Universal SSL covers `example.com` and `*.example.com`, one level deep. A name like `4323.p.example.com` needs a certificate the free plan does not issue, which is why the port goes in front: `p4323.example.com`.

## 3. Limen

In the repository root, set two values in `.env`:

```dotenv
LIMEN_DOMAIN=example.com
LIMEN_AUTH_HOST=auth.example.com
```

Then:

```bash
docker compose pull
docker compose up -d
curl -s https://auth.example.com/health
docker compose exec auth bun run src/invite.ts
```

The last command prints the first passkey invite. Login works once that is registered, nothing else on Cloudflare is involved.

## 4. Worker

Follow [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) to install Wrangler and log in, or use an API token with `Workers Scripts: Edit`, `Workers Routes: Edit`, and `Zone: Read`.

Then set the Limen values in `worker/wrangler.toml`:

```toml
[vars]
LIMEN_DOMAIN = "example.com"
LIMEN_AUTH_HOST = "auth.example.com"

routes = [
  { pattern = "*.example.com/*", zone_name = "example.com" }
]
```

Deploy with `npx wrangler deploy`. Routes are covered in [Workers routes](https://developers.cloudflare.com/workers/configuration/routing/routes/).

The Worker fails closed. If `[vars]` still contains the example domain, every request to your zone returns 404. Fix the values and redeploy. `npx wrangler delete` removes the Worker; Caddy still filters hosts on its own.

Verify the filter:

```bash
curl -sI https://unknown.example.com/ | grep -i x-host-filter   # x-host-filter: blocked
curl -s -o /dev/null -w "%{http_code}\n" https://pabc.example.com/   # 404
curl -s -o /dev/null -w "%{http_code}\n" https://p4323.example.com/  # 302
```

## 5. R2 for backups, optional

Create the bucket ([docs](https://developers.cloudflare.com/r2/buckets/create-buckets/)) and a token ([docs](https://developers.cloudflare.com/r2/api/tokens/)). Scope the token to `limen-backup` with Object Read & Write.

Configure rclone as described in [Rclone](https://developers.cloudflare.com/r2/examples/rclone/). One value matters for Limen: a bucket-scoped token needs `no_check_bucket = true`, otherwise rclone tries to create the bucket and gets a 403.

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <key>
secret_access_key = <secret>
endpoint = https://<account-id>.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
```

`gloak` is a separate project, build it first:

```bash
git clone https://github.com/StackNadi/gloak
cd gloak
mkdir -p ~/limen/backup/bin
go build -o ~/limen/backup/bin/gloak .
```

Then:

```bash
cd ~/limen/backup
cp env.example env && chmod 600 env
# set GLOAK_REMOTE="r2:limen-backup"
./install.sh
./backup.sh
./restore-drill.sh
```

The units are written with this checkout's path. Re-run `install.sh` if you move it.

Enable the timer only after the drill passes, and copy `backup/keys/identity.txt` off the machine first. Without that key the snapshots cannot be opened.

## 6. Verify

| Check | Command | Expected |
|---|---|---|
| Auth health | `curl -s https://auth.example.com/health` | `{"ok":true}` |
| Login page | `curl -s -o /dev/null -w "%{http_code}" https://auth.example.com/login` | `200` |
| Closed dashboard | `curl -s -o /dev/null -w "%{http_code}" https://auth.example.com/admin` | `302` |
| Port gate | `curl -s -o /dev/null -w "%{http_code}" https://p4323.example.com/` | `302` |
| Edge filter | `curl -sI https://unknown.example.com/ \| grep -i x-host-filter` | `x-host-filter: blocked` |
| Tunnel | `cloudflared tunnel info limen` | at least one connection |
| Containers | `docker compose ps` | both `healthy` |

## 7. When it breaks

For 1033, 1016, TLS failures, and other tunnel errors, use Cloudflare's [tunnel troubleshooting](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/).

These are the Limen-specific ones:

| Symptom | Cause |
|---|---|
| 404 for everything after deploying the Worker | `[vars]` still has the example domain |
| 503 page with a port number | Login worked, nothing is listening on that port |
| 403 from an app behind a port | The app rejects `Host: localhost`, which Caddy sends |
| Login loops | Use `https`, allow cookies for the zone, clear site data |

Implementation notes and the security properties are in [WORKFLOW.md](WORKFLOW.md).
