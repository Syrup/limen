import { Database } from "bun:sqlite";
import { randomBytes, createHmac, timingSafeEqual, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

export const DATA_DIR = process.env.AUTH_DATA_DIR || join(import.meta.dir, "..", "data");
const DB_PATH = process.env.AUTH_DB_PATH || join(DATA_DIR, "auth.db");
const SECRET_FILE = join(DATA_DIR, "invite-secret");

mkdirSync(DATA_DIR, { recursive: true });
try { chmodSync(DATA_DIR, 0o700); } catch {}
process.umask(0o077);

export type Credential = { id: string; publicKey: string; counter: number; transports?: string[]; createdAt: string };
export type InviteType = "access" | "passkey";
export type Invite = {
  id: string;
  type: InviteType;
  label: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  uses: number;
  maxUses: number | null;
  scope: "all" | number[];
};

export const UNITS = ["minutes", "hours", "days", "weeks", "months"] as const;
export type Unit = (typeof UNITS)[number];

const UNIT_MS: Record<Unit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_592_000_000,
};

export const MAX_DURATION_MS = 365 * 86_400_000;
export const MIN_DURATION_MS = 60_000;

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('access','passkey')),
    label TEXT NOT NULL DEFAULT '',
    scope TEXT NOT NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    claim_id TEXT,
    claim_expires_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('owner','guest')),
    scope TEXT NOT NULL,
    invite_id TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS blocked_ports (
    port INTEGER PRIMARY KEY,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    ip TEXT,
    ua TEXT
  );
`);
db.exec("PRAGMA user_version = 1");
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) { try { chmodSync(f, 0o600); } catch {} }

function getSecret(): Buffer {
  if (existsSync(SECRET_FILE)) {
    const raw = readFileSync(SECRET_FILE, "utf8").trim();
    if (raw) return Buffer.from(raw, "base64url");
  }
  const secret = randomBytes(32);
  writeFileSync(SECRET_FILE, secret.toString("base64url"));
  chmodSync(SECRET_FILE, 0o600);
  return secret;
}

const SECRET = getSecret();

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteToken(invite: Invite): string {
  return `${invite.id}.${sign(invite.id)}`;
}

function rowToInvite(row: any): Invite {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    scope: row.scope === "all" ? "all" : JSON.parse(row.scope),
    maxUses: row.max_uses,
    uses: row.uses,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : undefined,
  };
}

function getInviteById(id: string): Invite | null {
  const row = db.query("SELECT * FROM invites WHERE id = ?").get(id) as any;
  return row ? rowToInvite(row) : null;
}

export function loadCreds(): Credential[] {
  const rows = db.query("SELECT * FROM credentials ORDER BY created_at").all() as any[];
  return rows.map(row => ({
    id: row.id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: row.transports ? JSON.parse(row.transports) : undefined,
    createdAt: row.created_at,
  }));
}

export function addCredential(cred: Credential): void {
  db.query(`INSERT INTO credentials (id, public_key, counter, transports, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET public_key=excluded.public_key, counter=excluded.counter, transports=excluded.transports`)
    .run(cred.id, cred.publicKey, cred.counter, cred.transports ? JSON.stringify(cred.transports) : null, cred.createdAt);
}

export function updateCredentialCounter(id: string, counter: number): void {
  db.query("UPDATE credentials SET counter = ? WHERE id = ?").run(counter, id);
}

export function removeCredential(id: string): boolean {
  const result = db.query("DELETE FROM credentials WHERE id = ?").run(id);
  if (result.changes > 0) deleteOwnerSessions();
  return result.changes > 0;
}

export function deleteOwnerSessions(): void {
  db.query("DELETE FROM sessions WHERE kind = 'owner'").run();
}

export function loadInvites(): Invite[] {
  const rows = db.query("SELECT * FROM invites ORDER BY created_at DESC").all() as any[];
  return rows.map(rowToInvite);
}

export function inviteState(invite: Invite): "active" | "expired" | "revoked" | "used" {
  if (invite.revokedAt) return "revoked";
  if (Date.now() > Date.parse(invite.expiresAt)) return "expired";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "used";
  return "active";
}

export function findByToken(token: string): Invite | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return getInviteById(id);
}

export function durationMs(amount: number, unit: Unit): number {
  return amount * UNIT_MS[unit];
}

export function createInvite(input: {
  type: InviteType;
  label: string;
  durationMs: number;
  scope: "all" | number[];
}): Invite {
  const now = Date.now();
  const invite: Invite = {
    id: randomBytes(9).toString("base64url"),
    type: input.type,
    label: input.label.slice(0, 60),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + input.durationMs).toISOString(),
    uses: 0,
    maxUses: input.type === "passkey" ? 1 : null,
    scope: input.type === "passkey" ? "all" : input.scope,
  };
  db.query(`INSERT INTO invites (id, type, label, scope, max_uses, uses, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(
      invite.id,
      invite.type,
      invite.label,
      invite.scope === "all" ? "all" : JSON.stringify(invite.scope),
      invite.maxUses,
      now,
      now + input.durationMs,
    );
  return invite;
}

export function revokeInvite(id: string): Invite | null {
  const now = Date.now();
  const result = db.query("UPDATE invites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now, id);
  if (result.changes === 0) return getInviteById(id);
  db.query("DELETE FROM sessions WHERE invite_id = ?").run(id);
  return getInviteById(id);
}

export function deleteInvite(id: string): boolean {
  db.query("DELETE FROM sessions WHERE invite_id = ?").run(id);
  const result = db.query("DELETE FROM invites WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Access invites can be reused; this atomically consumes one use and returns the invite. */
export function consumeAccessInvite(token: string): Invite | null {
  const found = findByToken(token);
  if (!found || found.type !== "access") return null;
  const now = Date.now();
  const result = db.query(`UPDATE invites
    SET uses = uses + 1
    WHERE id = ? AND type = 'access' AND revoked_at IS NULL AND expires_at > ?
      AND (max_uses IS NULL OR uses < max_uses)`).run(found.id, now);
  return result.changes > 0 ? getInviteById(found.id) : null;
}

/** Atomically claims a single-use passkey invite so two concurrent verifies cannot both use it. */
export function claimPasskeyInvite(token: string): { invite: Invite; claimId: string } | null {
  const found = findByToken(token);
  if (!found || found.type !== "passkey") return null;
  const now = Date.now();
  const claimId = randomBytes(12).toString("base64url");
  const result = db.query(`UPDATE invites
    SET claim_id = ?, claim_expires_at = ?
    WHERE id = ? AND type = 'passkey' AND revoked_at IS NULL AND expires_at > ?
      AND (max_uses IS NULL OR uses < max_uses)
      AND (claim_id IS NULL OR claim_expires_at < ?)`).run(claimId, now + 5 * 60_000, found.id, now, now);
  return result.changes > 0 ? { invite: found, claimId } : null;
}

export function finalizePasskeyInvite(id: string, claimId: string): boolean {
  const result = db.query(`UPDATE invites
    SET uses = uses + 1, claim_id = NULL, claim_expires_at = NULL
    WHERE id = ? AND claim_id = ?`).run(id, claimId);
  return result.changes > 0;
}

export function releasePasskeyClaim(id: string, claimId: string): void {
  db.query("UPDATE invites SET claim_id = NULL, claim_expires_at = NULL WHERE id = ? AND claim_id = ?").run(id, claimId);
}

export function loadBlockedPorts(): Set<number> {
  const rows = db.query("SELECT port FROM blocked_ports").all() as any[];
  return new Set(rows.map(row => row.port));
}

export function setPortBlocked(port: number, blocked: boolean): void {
  if (blocked) {
    db.query("INSERT INTO blocked_ports (port, updated_at) VALUES (?, ?) ON CONFLICT(port) DO UPDATE SET updated_at=excluded.updated_at")
      .run(port, Date.now());
  } else {
    db.query("DELETE FROM blocked_ports WHERE port = ?").run(port);
  }
}

export function listeningPorts(): number[] {
  const ports = new Set<number>();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text = "";
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    for (const line of text.split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4 || parts[3] !== "0A") continue;
      const local = parts[1] || "";
      const colon = local.lastIndexOf(":");
      if (colon < 0) continue;
      const port = parseInt(local.slice(colon + 1), 16);
      if (Number.isFinite(port) && port > 0 && port <= 65535) ports.add(port);
    }
  }
  return [...ports].sort((a, b) => a - b);
}

export type SessionKind = "owner" | "guest";
export type Session = { kind: SessionKind; scope: "all" | number[]; expires: number; inviteId?: string };

export function createSession(kind: SessionKind, scope: "all" | number[], expiresAt: number, inviteId?: string): string {
  const token = randomBytes(32).toString("base64url");
  db.query(`INSERT INTO sessions (token_hash, kind, scope, invite_id, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)`)
    .run(hashToken(token), kind, scope === "all" ? "all" : JSON.stringify(scope), inviteId ?? null, Date.now(), expiresAt);
  return token;
}

export function getSession(token: string): Session | null {
  const row = db.query("SELECT * FROM sessions WHERE token_hash = ?").get(hashToken(token)) as any;
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.query("DELETE FROM sessions WHERE token_hash = ?").run(row.token_hash);
    return null;
  }
  return {
    kind: row.kind,
    scope: row.scope === "all" ? "all" : JSON.parse(row.scope),
    expires: row.expires_at,
    inviteId: row.invite_id ?? undefined,
  };
}

export function deleteSession(token: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function cleanupSessions(): void {
  db.query("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

/**
 * Keeps the newest guest sessions for one invite. A reusable access link can be
 * opened from unlimited browsers, so without a cap the sessions table grows
 * with every open.
 */
export function trimInviteSessions(inviteId: string, keep: number): void {
  db.query(`DELETE FROM sessions
    WHERE kind = 'guest' AND invite_id = ? AND token_hash NOT IN (
      SELECT token_hash FROM sessions
      WHERE kind = 'guest' AND invite_id = ?
      ORDER BY created_at DESC LIMIT ?
    )`).run(inviteId, inviteId, keep);
}

export function listSessions(): Array<{ kind: SessionKind; scope: "all" | number[]; expires: number; inviteId?: string }> {
  const rows = db.query("SELECT kind, scope, expires_at, invite_id FROM sessions ORDER BY expires_at").all() as any[];
  return rows.map(row => ({
    kind: row.kind,
    scope: row.scope === "all" ? "all" : JSON.parse(row.scope),
    expires: row.expires_at,
    inviteId: row.invite_id ?? undefined,
  }));
}

export function addAudit(input: {
  actor: string;
  action: string;
  target?: string;
  ip?: string;
  ua?: string;
}): void {
  db.query("INSERT INTO audit_log (at, actor, action, target, ip, ua) VALUES (?, ?, ?, ?, ?, ?)")
    .run(Date.now(), input.actor, input.action, input.target ?? null, input.ip ?? null, input.ua ?? null);
}

export function listAudit(limit = 50): Array<{ at: number; actor: string; action: string; target?: string; ip?: string }> {
  return db.query("SELECT at, actor, action, target, ip FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as any[];
}

/** Drops audit rows older than the retention window. */
export function pruneAudit(before: number): void {
  db.query("DELETE FROM audit_log WHERE at < ?").run(before);
}
