#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${GLOAK_BACKUP_ENV:-$SCRIPT_DIR/env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE (copy env.example to env and edit it)" >&2
  exit 78
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${GLOAK_BIN:?set GLOAK_BIN in env}"
: "${GLOAK_DIR:?set GLOAK_DIR in env}"
: "${GLOAK_REMOTE:?set GLOAK_REMOTE in env}"
: "${BUN_BIN:?set BUN_BIN in env}"
: "${COMPOSE_DIR:?set COMPOSE_DIR in env}"
: "${DB_PATH:?set DB_PATH in env}"

export GLOAK_DIR
if [[ -n "${RCLONE_CONFIG:-}" ]]; then export RCLONE_CONFIG; fi

if [[ ! -x "$GLOAK_BIN" ]]; then
  echo "gloak binary not executable: $GLOAK_BIN" >&2
  exit 78
fi
if [[ ! -f "$DB_PATH" ]]; then
  echo "database not found: $DB_PATH" >&2
  exit 78
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/limen-backup.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

echo "[$(date -Is)] snapshot $DB_PATH"
"$BUN_BIN" "$SCRIPT_DIR/snapshot.ts" "$DB_PATH" "$STAGE/auth.db"

if [[ -f "$COMPOSE_DIR/auth/data/invite-secret" ]]; then
  cp "$COMPOSE_DIR/auth/data/invite-secret" "$STAGE/invite-secret"
fi
for f in Caddyfile docker-compose.yml; do
  if [[ -f "$COMPOSE_DIR/$f" ]]; then cp "$COMPOSE_DIR/$f" "$STAGE/$f"; fi
done

echo "[$(date -Is)] upload to $GLOAK_REMOTE"
OUT="$("$GLOAK_BIN" backup "$STAGE" -R "$GLOAK_REMOTE" 2>&1 | tr '\r' '\n')"
printf '%s\n' "$OUT"

SNAP_ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -n 1)"
if [[ -z "$SNAP_ID" ]]; then
  echo "could not parse snapshot id from gloak output" >&2
  exit 1
fi

echo "[$(date -Is)] check"
"$GLOAK_BIN" check -R "$GLOAK_REMOTE"

echo "[$(date -Is)] verify $SNAP_ID"
"$GLOAK_BIN" verify "$SNAP_ID" -R "$GLOAK_REMOTE"

echo "[$(date -Is)] prune"
"$GLOAK_BIN" prune -R "$GLOAK_REMOTE" \
  --keep-last "${KEEP_LAST:-7}" \
  --keep-daily "${KEEP_DAILY:-7}" \
  --keep-weekly "${KEEP_WEEKLY:-4}" \
  --keep-monthly "${KEEP_MONTHLY:-0}" \
  --yes

echo "[$(date -Is)] done snapshot=$SNAP_ID"
