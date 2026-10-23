#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${GLOAK_BACKUP_ENV:-$SCRIPT_DIR/env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 78
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${GLOAK_BIN:?set GLOAK_BIN in env}"
: "${GLOAK_DIR:?set GLOAK_DIR in env}"
: "${GLOAK_REMOTE:?set GLOAK_REMOTE in env}"
: "${BUN_BIN:?set BUN_BIN in env}"

export GLOAK_DIR
if [[ -n "${RCLONE_CONFIG:-}" ]]; then export RCLONE_CONFIG; fi

SNAP_ID="$("$GLOAK_BIN" snapshots -R "$GLOAK_REMOTE" \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | head -n 1)"

if [[ -z "$SNAP_ID" ]]; then
  echo "no snapshots found in $GLOAK_REMOTE" >&2
  exit 1
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/limen-restore.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

echo "[$(date -Is)] restore $SNAP_ID"
"$GLOAK_BIN" restore "$SNAP_ID" -R "$GLOAK_REMOTE" -o "$TMP"

DB="$(find "$TMP" -name auth.db -print -quit)"
if [[ -z "$DB" ]]; then
  echo "auth.db not found in restored output" >&2
  exit 1
fi

echo "[$(date -Is)] verify restored database"
"$BUN_BIN" "$SCRIPT_DIR/verify-db.ts" "$DB"

echo "[$(date -Is)] restore drill ok"
