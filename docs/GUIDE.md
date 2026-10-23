# Limen: private links for local dev servers

This guide is for anyone who needs to open a dev server on this machine from a browser, without knowing how the plumbing works. Commands are copy-paste friendly, and every step says what it does.

## What this setup gives you

One private front door for every local web server. Start something on port 4323, open `https://p4323.example.com`, and you land on it. Same for any other port.

The front door is protected by a passkey. You prove who you are with your fingerprint, face, or security key. There is no password to remember and no password to leak.

Two things stay out of reach for strangers: the login page behind the door, and the servers behind it. Only someone who can log in with a registered passkey gets through.

## Before you start

You need three things:

1. A browser that supports passkeys: Chrome, Edge, Safari, or Firefox from the last few years.
2. A device with a screen lock: fingerprint reader, face unlock, Windows Hello, Touch ID, or a hardware security key.
3. Access to this machine over SSH, at least once, to create the registration link.

If your browser has no passkey support, the login button will fail. Update the browser or use a different one.

## Daily use

This is the whole routine.

1. Start your server on a port. Example: `astro dev --port 4323`.
2. Open `https://p4323.example.com`.
3. First visit in a new browser: click `Masuk dengan passkey`, approve with your fingerprint or face.
4. You are in. Later visits in the same browser skip the login because the browser keeps the session.

The link never changes. Port 4323 is always `p4323`, port 7000 is always `p7000`.

The pages follow your browser language automatically. A browser that asks for Indonesian gets Indonesian; everything else gets English. There is no language switch to manage and nothing to configure.

### The address pattern

The address is `https://p` followed by the port number, then `.example.com`.

| Server port | Address |
|---|---|
| 4323 | `https://p4323.example.com` |
| 4322 | `https://p4322.example.com` |
| 7000 | `https://p7000.example.com` |
| 8080 | `https://p8080.example.com` |

Port must be 2 to 5 digits. The number cannot start with 0, so `p04323` and `p00` are rejected. Addresses like `https://4323.example.com` or `https://p.example.com` do not work either. You will get a 404 with a short explanation, and the app behind the port never receives the request.

Two kinds of 404 exist. A page saying `Not found` comes from Cloudflare, which rejects the address before it reaches the server. A page saying `Subdomain tidak valid`, or `Invalid subdomain` in an English browser, comes from the server itself. Both mean the address is wrong.

### Logging out

Open `https://auth.example.com/logout`. The session ends on the server and the cookie is cleared. Your passkey stays registered, so the next login is one tap.

If you only close the tab, the session stays valid for 24 hours.

## Dashboard

Open `https://auth.example.com/admin` in a browser where you are signed in with your passkey. The dashboard is owner-only. Guests who redeem an access link cannot open it.

The dashboard has three parts:

- Create an invite, either temporary access or a passkey.
- Turn ports on or off.
- See every link with its scope, expiry, use count, and status. Copy, revoke, or delete any of them.

## Temporary access links

Use this to give someone access for a limited time without giving them a passkey.

1. In the dashboard, choose `Akses sementara`.
2. Set a label, a duration, and a unit from minutes to months. The maximum is 12 months. There is no forever option.
3. Choose `Semua port` or list specific ports, for example `4322, 4323`.
4. Create the link and send it to the person.

When they open it, the server creates a guest session in their browser and shows the ports they can open. The link keeps working until it is revoked or expires, and the guest session ends when the invite does. Revoke it from the dashboard when it is no longer needed.

Anyone who has the link can use it until then. Treat it like a temporary key, not a public URL.

## Adding a passkey to another device

You can register more than one passkey, for example your phone and your laptop.

1. In the dashboard, choose `Passkey`.
2. Set a duration and create the link.
3. Open the link on the device you want to add, click `Daftarkan passkey`, and approve.

The link works once. After the passkey is registered, the link stops working.

From the command line, the same link can be created without the dashboard:

```bash
cd ~/.config/limen
docker compose exec auth bun run invite.ts
```

## Turning ports off

The `Port` panel lists every port that is listening on the machine. Use the switch to block or allow a port. Blocked ports return a page saying the port is turned off, and no app behind it is contacted.

Ports 22, 8088, and 8099 are locked because they carry SSH, the proxy, and the auth service. Blocking them would cut the way back in.

A port that is not currently listening still appears if you blocked it, so the block survives a restart of the app.

## Backup

Offsite backup uses [gloak](https://github.com/StackNadi/gloak), a separate tool you build from its own Go source. The script snapshots SQLite with `VACUUM INTO`, uploads it, checks it, verifies every chunk, and prunes old snapshots. A restore drill is available separately. The binary is not part of this repo: put it where `GLOAK_BIN` in `backup/env` points, for example `backup/bin/gloak`.

One-time setup:

```bash
cd ~/.config/limen/backup
cp env.example env
chmod 600 env
# edit GLOAK_REMOTE, for example r2:limen-backup
./install.sh
```

The installer links the systemd timer, creates the encryption key if needed, and initializes the repository. For the first week, run the backup manually and only enable the timer after a restore drill passes:

```bash
systemctl --user enable --now gloak-backup.timer
```

For Cloudflare R2, the API token is scoped to one bucket, so rclone must skip the bucket existence check. Without this, rclone tries to create the bucket and gets 403:

```bash
rclone config update r2 no_check_bucket true
rclone lsd r2:limen-backup
```

`rclone lsd r2:` will return 403 for a bucket-scoped token. That is normal.

Run manually:

```bash
cd ~/.config/limen/backup
./backup.sh
./restore-drill.sh
```

Restore drill matters. It restores the newest snapshot and runs `PRAGMA integrity_check`. A backup that has never been restored is not a backup yet.

Keep `backup/keys/identity.txt` outside the laptop. If the laptop dies and the key dies with it, the encrypted backups cannot be opened. gloak is still alpha, so keep one independent copy until it reaches beta. See `WORKFLOW.md` for the full procedure.

## Setup from scratch

Use this when setting up a new machine or rebuilding after a disk problem.

### Step 1: check Docker

```bash
docker --version
docker compose version
```

Both commands must print a version. If Docker is missing, install it first.

### Step 2: put the files in place

The project lives in `~/.config/limen`. Copy the whole folder, including `auth/data/auth.db` and `auth/data/invite-secret`. The database holds your passkeys, invites, sessions, blocked ports, and audit log. The secret keeps existing invite links valid. If you also use offsite backup, copy `backup/keys/` from your password manager, not from the broken machine.

If you are starting from a fresh clone instead of an existing install, create the deployment file first:

```bash
cp .env.example .env
```

Then set `LIMEN_DOMAIN` and `LIMEN_AUTH_HOST` in `.env`. Without them the containers refuse to start, which is deliberate.

### Step 3: start the containers

```bash
cd ~/.config/limen
docker compose up -d --build
```

Wait about ten seconds. Two containers should be running:

```bash
docker compose ps
```

You want `limen` and `limen-core` with status `Up`.

### Step 4: check the auth service

```bash
curl -s https://auth.example.com/health
```

Expected answer: `{"ok":true}`.

If this fails, jump to the common errors section below.

### Step 5: register the first passkey

With no passkeys on the machine, you still need an invite. Create one:

```bash
docker compose exec auth bun run invite.ts
```

Open the printed link in your browser and approve the passkey prompt. After that, the link is dead and the account has one key.

### Step 6: test one port

Start any local server on a port, then open `https://p<port>.example.com`. You should see the login page first, then the site.

## Common errors

### The page keeps asking me to log in

The browser is not keeping the session cookie. Usually the cause is one of these:

- You opened `http://` instead of `https://`. The cookie is marked secure, so plain HTTP cannot use it. Use the `https://` address.
- Cookies are blocked for `example.com`. Allow them, or turn off strict tracking protection for this site.
- You are in a private window and closed it. Private windows drop cookies when they close.
- You logged out. That is expected. Log in again.

If it still loops, clear site data for `example.com` in the browser and try once more.

### 503 Service Unavailable

You will see a page from the proxy itself, usually titled "Tidak ada layanan di balik alamat ini" and showing the port, for example `Port 4323`. That means the login worked and the proxy could not reach the app. The old Cloudflare error page is replaced by this one.

The status is 503, not 502. Cloudflare replaces 502 bodies from the origin with its own page, so the proxy uses 503 to make the custom page reach you.

Check whether something listens on the port:

```bash
ss -tln | grep ':4323'
```

No output means the dev server is not running or is on a different port. Start it, or use the correct port number in the address. Then click `Muat ulang` on the error page.

If the page has no port row, the auth service itself is down:

```bash
cd ~/.config/limen
docker compose ps
docker compose logs --tail=50 auth
docker compose up -d auth
```

### 404 with "Subdomain tidak valid" / "Invalid subdomain"

The address does not follow the pattern. Use `p` plus the port, for example `https://p4323.example.com`. Do not use two levels like `4323.p.example.com`, and do not drop the `p`.

### "Tautan undangan tidak valid"

The link was used, revoked, or it expired. Create a new one from the dashboard, or with the command line:

```bash
cd ~/.config/limen
docker compose exec auth bun run invite.ts
```

For temporary access, add the type and scope:

```bash
docker compose exec auth bun run invite.ts --type access --duration 2 --unit hours --scope 4322,4323
```

A passkey link works once. An access link keeps working until it is revoked or expires.

### "Port ini tidak tersedia"

The port is blocked in the dashboard. Open `https://auth.example.com/admin`, find it in the `Port` panel, and turn it back on. The public error page does not mention the dashboard, so keep the URL private.

### "Port ini di luar aksesmu"

You redeemed a temporary access link that only covers certain ports, and you opened a different one. Ask for a new link with the port you need.

### "Terlalu banyak percobaan"

The service allows 60 API requests per minute from one IP address. Wait a minute and try again. This shows up if you refresh the login page many times in a row.

### Passkey prompt does not appear

Possible causes, in order of likelihood:

1. The browser is old or has passkeys disabled. Update it.
2. The device has no screen lock, so it has no platform authenticator. Set a PIN, fingerprint, or face unlock.
3. You are opening the site through an IP address or a domain other than `example.com` and its subdomains. Passkeys are tied to the domain they were registered for.
4. A browser extension is blocking WebAuthn. Try a clean profile.

### "SecurityError" or "relying party ID" message

You reached the login page through the wrong address. Use `https://auth.example.com` exactly. Accessing through an IP address or another domain will fail, because the passkey is tied to `example.com`.

### Site cannot be reached at all

Cloudflare answers but the tunnel is down, usually shown as error 1033, 521, or 522.

Check the tunnel on the server:

```bash
systemctl --user status cloudflared
systemctl --user restart cloudflared
cloudflared tunnel info <tunnel-name>
```

The `tunnel info` output should list active connections. If it lists none, the machine may be offline or the tunnel credentials are missing.

### Login page loads but the button does nothing

The passkey library ships inside the container, so a blocked CDN cannot cause this. If the button still does nothing, open the browser console. A failed request for `/assets/webauthn.js` means the image was built without the bundle step, so rebuild with `docker compose up -d --build auth`. An extension that blocks WebAuthn usually fails quietly, so try a clean browser profile before rebuilding.

### Session still active after a restart

Sessions are stored in the database, so restarting the container does not sign you out. They expire on their own: 24 hours for the owner, and the invite expiry for guests. Use the logout link to end a session early. Removing a passkey signs out every owner session.

### Passkey no longer works after moving to a new domain

Passkeys are bound to the domain they were created on. Changing `example.com` to another domain invalidates every existing passkey. You would need to register new ones. See `WORKFLOW.md` for the full procedure.

## What not to do

- Do not share invite links publicly. They are temporary keys to the front door.
- Do not expose ports 8088 or 8099 to the internet directly. They are bound to loopback on purpose, and Cloudflare is the only way in.
- Do not delete `auth/data/auth.db` unless you intend to lose every passkey, invite, and session.
- Do not delete `auth/data/invite-secret`. Every invite link is derived from it, so removing it invalidates all existing links.
- Do not commit `auth/data/` to git. It contains passkeys, invite state, sessions, and the signing secret.
- Do not delete `backup/keys/identity.txt`. Without it, no offsite backup can be restored. Keep a copy in a password manager and one offline copy.
- Do not use two-level subdomains such as `4323.p.example.com`. The free Cloudflare certificate only covers one level.

## Quick reference

| Task | Command |
|---|---|
| Start everything | `cd ~/.config/limen && docker compose up -d` |
| Stop everything | `cd ~/.config/limen && docker compose down` |
| Restart auth only | `docker compose restart auth` |
| Rebuild auth after code change | `docker compose up -d --build auth` |
| Rebuild dashboard CSS | `cd admin-ui && npm run build` |
| Show auth logs | `docker compose logs -f auth` |
| Show proxy logs | `docker compose logs -f proxy` |
| Create passkey link | `docker compose exec auth bun run invite.ts` |
| Create access link | `docker compose exec auth bun run invite.ts --type access --duration 2 --unit hours --scope all` |
| List passkeys | `docker compose exec auth bun run passkey.ts list` |
| Remove a passkey | `docker compose exec auth bun run passkey.ts remove <id>` |
| Run backup | `cd backup && ./backup.sh` |
| Restore drill | `cd backup && ./restore-drill.sh` |
| Dashboard | open `https://auth.example.com/admin` |
| Log out | open `https://auth.example.com/logout` |
| Health check | `curl -s https://auth.example.com/health` |

For the internals, security properties, and recovery procedures, read `WORKFLOW.md`.
