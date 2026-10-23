/**
 * Everything that differs between installs comes from the environment, so the
 * same image runs on any domain. Docker Compose reads the same names from .env.
 * Missing required values stop the process instead of falling back to a
 * plausible but wrong default.
 */

function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  console.error(`[limen] missing required environment variable: ${name}`);
  process.exit(78);
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`[limen] ${name} must be a positive number`);
    process.exit(78);
  }
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const DOMAIN = env("LIMEN_DOMAIN").toLowerCase();
export const AUTH_HOST = env("LIMEN_AUTH_HOST", `auth.${DOMAIN}`).toLowerCase();
export const AUTH_ORIGIN = `https://${AUTH_HOST}`;
export const COOKIE_DOMAIN = `.${DOMAIN}`;

export const RP_ID = DOMAIN;
export const RP_NAME = env("LIMEN_RP_NAME", "Limen");
export const OWNER_NAME = env("LIMEN_OWNER_NAME", "owner");

export const TZ = env("LIMEN_TZ", process.env.TZ || "UTC");

export const PORT = num("PORT", 8099);
export const PROXY_PORT = num("LIMEN_PROXY_PORT", 8088);
export const SSH_PORT = num("LIMEN_SSH_PORT", 22);
export const SYSTEM_PORTS = new Set([SSH_PORT, PORT, PROXY_PORT]);

export const OWNER_TTL_MS = num("LIMEN_OWNER_TTL_HOURS", 24) * HOUR_MS;
export const MAX_COOKIE_AGE = num("LIMEN_MAX_COOKIE_AGE_DAYS", 400) * DAY_MS;
export const MAX_GUEST_SESSIONS = num("LIMEN_MAX_GUEST_SESSIONS", 20);
export const RATE_LIMIT_MAX = num("LIMEN_RATE_LIMIT_MAX", 60);
export const AUDIT_RETENTION_MS = num("LIMEN_AUDIT_RETENTION_DAYS", 90) * DAY_MS;

export const PORT_HOST_RE = new RegExp(`^p([1-9][0-9]{0,4})\\.${escapeRegExp(DOMAIN)}$`);

export function portHost(port: number): string {
  return `p${port}.${DOMAIN}`;
}

export function isOurHost(hostname: string): boolean {
  return hostname === DOMAIN || hostname.endsWith(`.${DOMAIN}`);
}
