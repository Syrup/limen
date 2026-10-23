# Contributing

This is a small project, so the process is short. Open an issue for anything larger than a typo, keep each change focused, and say what you tested.

## What this is

Limen puts one passkey gate in front of every local HTTP server on a machine. Caddy dispatches `p<port>.<domain>` to `localhost:<port>` after the auth service allows it. The request path and the threat model are in [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Setup

You need Bun 1.3 or newer, and Docker with Compose.

```bash
git clone <repo> limen
cd limen
cp .env.example .env
$EDITOR .env          # set LIMEN_DOMAIN and LIMEN_AUTH_HOST
docker compose up -d --build
curl -s https://auth.<domain>/health
```

Nothing works without a real domain: passkeys are bound to it and the session cookies are `Secure`. For layout work you can bypass the owner check with `ADMIN_DEV_OPEN=1` and a `NODE_ENV` other than `production`, but never in a deployment that faces the internet.

## Tests

```bash
make test          # both suites
make test-auth     # bun test in auth/
make test-worker   # bun test in worker/
make typecheck     # tsc --noEmit in auth/
```

The auth suite starts the service on port 18099 against a temporary SQLite database, so it never touches `auth/data`. The worker suite stubs `fetch` and checks the allowlist.

Add a test for anything that changes behaviour. The invite lifecycle, session scoping, and the origin checks are the parts most likely to break without anyone noticing.

## Layout

| Path | What lives there |
|---|---|
| `auth/src` | the Bun service: routes, store, UI, config, locales |
| `auth/test` | tests, run with `bun test` |
| `auth/assets` | fonts, vendored JS, and the stylesheet built by `admin-ui` |
| `proxy` | Caddyfile and the error pages |
| `worker` | Cloudflare edge host filter |
| `backup` | snapshot and restore scripts, systemd units |
| `docs` | the guide and the technical reference |

## Adding a language

1. Copy `auth/src/i18n/en.json` to `auth/src/i18n/<code>.json` and translate the values. Leave the keys alone.
2. Run `make test`. One test compares every locale against English and fails when a key is missing or extra.
3. Optional: copy `proxy/errors/502.en.html` to `502.<code>.html` and add one matcher plus one `respond` line to the invalid-host block and the 502 block in `proxy/Caddyfile`.

The filename is the language code from `Accept-Language` and it is also handed to `Intl`, so `de.json` or `pt-BR.json` work without a code change. The service scans the directory at startup, which is what lets a translation platform add a language by opening a pull request.

The files are plain JSON in the i18next v4 shape on purpose. Weblate imports that format directly, so a translation platform can open a pull request without anyone touching TypeScript. English is the source of truth: add a string there first, and the parity test will tell you which locales still need it.

## Style

- Match the file you are editing. The codebase uses two spaces, double quotes, and no semicolons omitted by accident.
- Comments explain why. Keep them to one or two lines.
- Avoid new runtime dependencies. The image stays small on purpose, and the auth service runs on a 4 GiB machine.
- Code, comments, commits, docs, and CLI output are English. Web pages are translated through `auth/src/i18n/`.
- Never commit `.env`, `auth/data`, `backup/env`, `backup/keys`, or the gloak binary. `.gitignore` covers them; check `git status` before pushing.

## Commits and pull requests

- Use conventional prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `chore`.
- One logical change per commit.
- In the pull request, describe what changed, how you tested it, and anything you could not test. A real passkey ceremony needs an authenticator, so say so when you skipped it.
- If you touch `proxy/Caddyfile` or `docker-compose.yml`, run `make config` and paste the result.

## Security

If you find a way past the gate, do not open a public issue. Use a private report through the Security tab on the repository.
