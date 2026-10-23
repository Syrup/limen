#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

mkdir -p "$UNIT_DIR"
for unit in gloak-backup.service gloak-backup.timer gloak-backup-alert.service; do
  tmp="$(mktemp)"
  sed "s|@LIMEN_HOME@|$REPO_DIR|g" "$SCRIPT_DIR/systemd/$unit" > "$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$UNIT_DIR/$unit"
done
systemctl --user daemon-reload

if [[ ! -f "$SCRIPT_DIR/env" ]]; then
  cp "$SCRIPT_DIR/env.example" "$SCRIPT_DIR/env"
  chmod 600 "$SCRIPT_DIR/env"
  echo "Created $SCRIPT_DIR/env."
  echo "Edit GLOAK_REMOTE and rclone config, then run this script again."
  exit 0
fi

if grep -q "CHANGE_ME" "$SCRIPT_DIR/env"; then
  echo "Edit $SCRIPT_DIR/env first: GLOAK_REMOTE still contains CHANGE_ME."
  exit 1
fi

# shellcheck disable=SC1090
source "$SCRIPT_DIR/env"
: "${GLOAK_BIN:?set GLOAK_BIN in env}"
: "${GLOAK_DIR:?set GLOAK_DIR in env}"
: "${GLOAK_REMOTE:?set GLOAK_REMOTE in env}"

if [[ ! -x "$GLOAK_BIN" ]]; then
  echo "gloak binary not executable: $GLOAK_BIN" >&2
  exit 1
fi

if [[ ! -f "$GLOAK_DIR/identity.txt" ]]; then
  mkdir -p "$GLOAK_DIR"
  chmod 700 "$GLOAK_DIR"
  GLOAK_DIR="$GLOAK_DIR" "$GLOAK_BIN" keygen
  echo
  echo "IMPORTANT: copy $GLOAK_DIR/identity.txt to a password manager and one offline copy."
  echo "Without it, no backup can be restored."
fi

if ! GLOAK_DIR="$GLOAK_DIR" "$GLOAK_BIN" snapshots -R "$GLOAK_REMOTE" >/dev/null 2>&1; then
  echo "Initializing repository at $GLOAK_REMOTE"
  GLOAK_DIR="$GLOAK_DIR" "$GLOAK_BIN" init -R "$GLOAK_REMOTE"
fi

systemctl --user enable --now gloak-backup.timer
systemctl --user list-timers gloak-backup.timer --no-pager
