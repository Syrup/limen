import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { randomBytes, createHash } from "node:crypto";
import { join } from "node:path";
import {
  loadCreds,
  addCredential,
  updateCredentialCounter,
  findByToken,
  inviteState,
  consumeAccessInvite,
  claimPasskeyInvite,
  finalizePasskeyInvite,
  releasePasskeyClaim,
  createInvite,
  revokeInvite,
  deleteInvite,
  loadBlockedPorts,
  setPortBlocked,
  createSession,
  getSession,
  deleteSession,
  cleanupSessions,
  trimInviteSessions,
  pruneAudit,
  addAudit,
  durationMs,
  UNITS,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  type Unit,
  type InviteType,
  type Session,
} from "./store.ts";
import {
  UI,
  resolveLang,
  renderLogin,
  renderRegister,
  renderSignedIn,
  renderInviteInvalid,
  renderAccessGranted,
  renderPortBlocked,
  renderPortDenied,
  type Lang,
} from "./ui.ts";
import { renderAdmin } from "./admin.ts";
import { renderInvitesFragment, renderPortsFragment } from "./fragments.ts";
import {
  AUDIT_RETENTION_MS,
  AUTH_HOST,
  AUTH_ORIGIN,
  COOKIE_DOMAIN,
  MAX_COOKIE_AGE,
  MAX_GUEST_SESSIONS,
  OWNER_NAME,
  OWNER_TTL_MS,
  PORT,
  PORT_HOST_RE,
  RATE_LIMIT_MAX,
  RP_ID,
  RP_NAME,
  SYSTEM_PORTS,
  isOurHost,
  portHost,
} from "./config.ts";

const OWNER_COOKIE = "ag_session";
const GUEST_COOKIE = "ag_access";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEV_OPEN = process.env.NODE_ENV !== "production" && process.env.ADMIN_DEV_OPEN === "1";

type Challenge = { challenge: string; type: "reg" | "auth"; expires: number };

const challenges = new Map<string, Challenge>();
const rateBuckets = new Map<string, { count: number; reset: number }>();

function b64uToBuf(s: string): Uint8Array { return new Uint8Array(Buffer.from(s, "base64url")); }
function bufToB64u(b: Uint8Array | ArrayBuffer): string { return Buffer.from(b).toString("base64url"); }

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    const raw = rest.join("=");
    // A malformed percent escape in a cookie must not take the whole request
    // down. Browsers rarely send one, but a stale or hand-made cookie can.
    try { out[key] = decodeURIComponent(raw); } catch { out[key] = raw; }
  }
  return out;
}

/**
 * WebAuthn ceremonies and admin writes only ever run on the auth host. Accepting
 * any subdomain origin would let a proxied dev app forge admin POSTs with the
 * shared session cookie.
 */
function isAllowedOrigin(origin: string): boolean {
  return origin === AUTH_ORIGIN;
}

function originFromRequest(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}`;
}

function safeNext(next: unknown): string {
  if (typeof next !== "string" || next === "") return "/";
  // Path internal, mis. /admin. Tolak //host dan backslash.
  if (next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) return next;
  try {
    const url = new URL(next);
    if (url.protocol !== "https:") return "/";
    if (!isOurHost(url.hostname)) return "/";
    return url.toString();
  } catch {
    return "/";
  }
}

function nextPort(next: string): number | null {
  try {
    const url = new URL(next);
    const match = url.hostname.match(PORT_HOST_RE);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || "local";
}

function sweepRateBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (bucket.reset < now) rateBuckets.delete(key);
}

function rateLimited(req: Request): boolean {
  const now = Date.now();
  if (rateBuckets.size > 2048) sweepRateBuckets();
  const key = clientIp(req);
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset < now) {
    rateBuckets.set(key, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, value] of challenges) if (value.expires < now) challenges.delete(key);
}

function auditRequest(req: Request, actor: string, action: string, target?: string): void {
  addAudit({
    actor,
    action,
    target,
    ip: clientIp(req),
    ua: req.headers.get("user-agent") || undefined,
  });
}

function getOwner(req: Request): Session | null {
  const token = parseCookies(req)[OWNER_COOKIE];
  if (!token) return null;
  const session = getSession(token);
  return session && session.kind === "owner" ? session : null;
}

function getGuest(req: Request): Session | null {
  const token = parseCookies(req)[GUEST_COOKIE];
  if (!token) return null;
  const session = getSession(token);
  return session && session.kind === "guest" ? session : null;
}

function isOwner(req: Request): boolean {
  return DEV_OPEN || getOwner(req) !== null;
}

function ownerCookie(token: string): string {
  return `${OWNER_COOKIE}=${token}; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(OWNER_TTL_MS / 1000)}`;
}

function guestCookie(token: string, expires: number): string {
  const age = Math.min(MAX_COOKIE_AGE, Math.max(60, Math.floor((expires - Date.now()) / 1000)));
  return `${GUEST_COOKIE}=${token}; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}

function clearAuthCookies(): string[] {
  return [
    `${OWNER_COOKIE}=; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${GUEST_COOKIE}=; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  ];
}

const BASE_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

function inlineScriptHashes(body: string): string[] {
  const hashes: string[] = [];
  for (const match of body.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = match[1] ?? "";
    const code = match[2] ?? "";
    if (/\ssrc=/.test(attrs) || code.trim() === "") continue;
    hashes.push(`'sha256-${createHash("sha256").update(code).digest("base64")}'`);
  }
  return hashes;
}

function contentSecurityPolicy(body: string): string {
  const scripts = ["'self'", ...inlineScriptHashes(body)];
  // Alpine and htmx compile expressions with new Function(), so the dashboard
  // needs 'unsafe-eval'. The login pages have no such dependency.
  if (body.includes('src="/assets/alpine.min.js"') || body.includes('src="/assets/htmx.min.js"')) {
    scripts.push("'unsafe-eval'");
  }
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...BASE_HEADERS, ...headers },
  });
}

function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": contentSecurityPolicy(body),
      ...BASE_HEADERS,
      ...headers,
    },
  });
}

function redirect(url: string, status = 302, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { location: url, ...BASE_HEADERS, ...headers } });
}

function reconstructNextUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || AUTH_HOST;
  const uri = req.headers.get("x-forwarded-uri") || "/";
  return `https://${host}${uri}`;
}

function adminOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return isAllowedOrigin(origin);
  // Browsers send Origin on POST. A request without it is a CLI client, unless
  // it carries Sec-Fetch-Site, which every browser sends.
  return req.headers.get("sec-fetch-site") === null;
}

async function serveAsset(path: string): Promise<Response> {
  const rel = path.replace(/^\/assets\//, "");
  if (!/^[A-Za-z0-9._\/-]+$/.test(rel) || rel.split("/").includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const root = join(import.meta.dir, "assets");
  const filePath = join(root, rel);
  if (!filePath.startsWith(root + "/")) return new Response("Not found", { status: 404 });
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  const type = rel.endsWith(".js")
    ? "text/javascript; charset=utf-8"
    : rel.endsWith(".css")
      ? "text/css; charset=utf-8"
      : rel.endsWith(".woff2")
        ? "font/woff2"
        : rel.endsWith(".svg")
          ? "image/svg+xml"
          : "application/octet-stream";
  const cache = rel.endsWith(".woff2") ? "public, max-age=31536000, immutable" : "no-cache";
  return new Response(file, { headers: { "content-type": type, "cache-control": cache, ...BASE_HEADERS } });
}

async function readBody(req: Request): Promise<Record<string, any>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  const out: Record<string, any> = {};
  for (const [key, value] of form) out[key] = typeof value === "string" ? value : value.name;
  return out;
}

function toastHeader(message: string, kind: "ok" | "error" = "ok"): string {
  return JSON.stringify({ toast: { message, kind } });
}

function scopeAllows(scope: "all" | number[], port: number): boolean {
  return scope === "all" || scope.includes(port);
}

export const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    cleanupExpired();
    const url = new URL(req.url);
    const path = url.pathname;
    const lang = resolveLang(req);
    const api = UI[lang].api;

    if (path.startsWith("/assets/")) return serveAsset(path);

    // /verify is deliberately exempt: every request to a port host calls it, so
    // a per-minute cap there would break normal page loads.
    const sensitive =
      path.startsWith("/api/") ||
      path === "/access" ||
      (path.startsWith("/admin/") && req.method === "POST");

    if (sensitive && rateLimited(req)) {
      if (path.startsWith("/api/")) return json({ error: api.rateLimited }, 429);
      return new Response(api.rateLimited, {
        status: 429,
        headers: { "content-type": "text/plain; charset=utf-8", ...BASE_HEADERS },
      });
    }

    if (path === "/verify") {
      const port = Number(req.headers.get("x-port") || "");
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return new Response("Missing port", { status: 400 });
      }

      if (loadBlockedPorts().has(port)) {
        return html(renderPortBlocked(lang, port), 403);
      }

      if (getOwner(req)) return new Response(null, { status: 200 });

      const guest = getGuest(req);
      if (guest) {
        if (scopeAllows(guest.scope, port)) return new Response(null, { status: 200 });
        return html(renderPortDenied(lang, port, guest.scope === "all" ? [] : guest.scope), 403);
      }

      const next = encodeURIComponent(reconstructNextUrl(req));
      return redirect(`${AUTH_ORIGIN}/login?next=${next}`, 302);
    }

    if (path === "/logout") {
      const cookies = parseCookies(req);
      if (cookies[OWNER_COOKIE]) deleteSession(cookies[OWNER_COOKIE]);
      if (cookies[GUEST_COOKIE]) deleteSession(cookies[GUEST_COOKIE]);
      auditRequest(req, "owner", "logout");
      const headers = new Headers({ location: `${AUTH_ORIGIN}/login` });
      for (const cookie of clearAuthCookies()) headers.append("set-cookie", cookie);
      return new Response(null, { status: 302, headers });
    }

    if (path === "/") return redirect("/login", 302);

    if (path === "/login" && req.method === "GET") {
      if (isOwner(req)) {
        const next = url.searchParams.get("next");
        return next ? redirect(safeNext(next), 302) : html(renderSignedIn(lang));
      }
      return html(renderLogin(lang));
    }

    if (path === "/register" && req.method === "GET") {
      const invite = findByToken(url.searchParams.get("token") || "");
      if (!invite || invite.type !== "passkey" || inviteState(invite) !== "active") {
        return html(renderInviteInvalid(lang), 403);
      }
      return html(renderRegister(lang));
    }

    if (path === "/access" && req.method === "GET") {
      const invite = consumeAccessInvite(url.searchParams.get("token") || "");
      if (!invite) {
        return html(renderInviteInvalid(lang), 403);
      }

      const expires = Date.parse(invite.expiresAt);

      const wanted = safeNext(url.searchParams.get("next"));
      let target = "/access/granted";
      if (wanted !== "/" && scopeAllows(invite.scope, nextPort(wanted) ?? -1)) {
        target = wanted;
      } else if (invite.scope !== "all" && invite.scope.length === 1) {
        target = `https://${portHost(invite.scope[0]!)}/`;
      }

      const existing = getGuest(req);
      if (existing && existing.inviteId === invite.id) {
        // Opening the link again in the same browser keeps the session instead
        // of writing another row every time.
        return redirect(target, 302);
      }

      const token = createSession("guest", invite.scope, expires, invite.id);
      trimInviteSessions(invite.id, MAX_GUEST_SESSIONS);
      auditRequest(req, "guest", "access_redeem", invite.id);

      return redirect(target, 302, { "set-cookie": guestCookie(token, expires) });
    }

    if (path === "/access/granted" && req.method === "GET") {
      const guest = getGuest(req);
      if (!guest) return redirect("/login", 302);
      return html(renderAccessGranted(lang, guest.scope, new Date(guest.expires).toISOString()));
    }

    if (path === "/admin" && req.method === "GET") {
      if (!isOwner(req)) {
        // Jangan konfirmasi keberadaan dashboard ke sesi tamu.
        if (getGuest(req)) return new Response("Not found", { status: 404 });
        return redirect("/login?next=%2Fadmin", 302);
      }
      return html(renderAdmin(lang));
    }

    if (path === "/health") return json({ ok: true });

    // --- admin fragments ---
    if ((path === "/fragments/invites" || path === "/fragments/ports") && req.method === "GET") {
      if (!isOwner(req)) return new Response("Not found", { status: 404 });
      return html(path.endsWith("invites") ? renderInvitesFragment(lang) : renderPortsFragment(lang));
    }

    if (path.startsWith("/admin/") && req.method === "POST") {
      if (!isOwner(req)) return new Response("Not found", { status: 404 });
      if (!adminOriginOk(req)) {
        return html(renderInvitesFragment(lang), 403, { "HX-Trigger": toastHeader(api.originDenied, "error") });
      }
    }

    if (path === "/admin/invites" && req.method === "POST") {
      const body = await readBody(req);
      const type: InviteType = body.type === "passkey" ? "passkey" : "access";
      const amount = Number(body.amount);
      const unit = String(body.unit) as Unit;

      if (!UNITS.includes(unit)) {
        return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(api.invalidDuration, "error") });
      }

      const ms = durationMs(amount, unit);
      if (!Number.isInteger(amount) || amount < 1 || ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) {
        return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(api.invalidDuration, "error") });
      }

      let scope: "all" | number[] = "all";
      if (type === "access" && body.scope !== "all") {
        const ports = String(body.ports || "")
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(Number);
        const unique = [...new Set(ports)];
        if (unique.length === 0 || unique.some(p => !Number.isInteger(p) || p < 1 || p > 65535)) {
          return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(api.invalidScope, "error") });
        }
        scope = unique.sort((a, b) => a - b);
      }

      const created = createInvite({
        type,
        label: typeof body.label === "string" ? body.label.trim() : "",
        durationMs: ms,
        scope,
      });
      auditRequest(req, "owner", "invite_create", created.id);

      return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(UI[lang].admin.toastCreated) });
    }

    const actionMatch = path.match(/^\/admin\/invites\/([A-Za-z0-9_-]+)\/(revoke|delete)$/);
    if (actionMatch && req.method === "POST") {
      if (actionMatch[2] === "revoke") {
        if (!revokeInvite(actionMatch[1])) {
          return html(renderInvitesFragment(lang), 404, { "HX-Trigger": toastHeader("not found", "error") });
        }
        auditRequest(req, "owner", "invite_revoke", actionMatch[1]);
        return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(UI[lang].admin.toastRevoked) });
      }
      if (!deleteInvite(actionMatch[1])) {
        return html(renderInvitesFragment(lang), 404, { "HX-Trigger": toastHeader("not found", "error") });
      }
      auditRequest(req, "owner", "invite_delete", actionMatch[1]);
      return html(renderInvitesFragment(lang), 200, { "HX-Trigger": toastHeader(UI[lang].admin.toastDeleted) });
    }

    if (path === "/admin/ports" && req.method === "POST") {
      const body = await readBody(req);
      const port = Number(body.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return html(renderPortsFragment(lang), 200, { "HX-Trigger": toastHeader(api.invalidPort, "error") });
      }
      if (SYSTEM_PORTS.has(port)) {
        return html(renderPortsFragment(lang), 200, { "HX-Trigger": toastHeader(api.systemPort, "error") });
      }

      const wantBlocked = body.blocked === true || body.blocked === "true";
      setPortBlocked(port, wantBlocked);
      auditRequest(req, "owner", wantBlocked ? "port_block" : "port_allow", String(port));

      return html(renderPortsFragment(lang), 200, {
        "HX-Trigger": toastHeader(wantBlocked ? UI[lang].admin.toastPortOff : UI[lang].admin.toastPortOn),
      });
    }


    // --- passkey login ---
    if (path === "/api/webauthn/login/options" && req.method === "POST") {
      const creds = loadCreds();
      if (creds.length === 0) return json({ error: api.noPasskey }, 400);

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports as any })),
        userVerification: "preferred",
      });
      const cid = bufToB64u(randomBytes(16));
      challenges.set(cid, { challenge: options.challenge, type: "auth", expires: Date.now() + CHALLENGE_TTL_MS });
      return json({ options, challengeId: cid });
    }

    if (path === "/api/webauthn/login/verify" && req.method === "POST") {
      const creds = loadCreds();
      const body = await req.json() as any;
      const challenge = challenges.get(body.challengeId);
      if (!challenge || challenge.type !== "auth" || challenge.expires < Date.now()) {
        return json({ error: api.challengeInvalid }, 400);
      }
      challenges.delete(body.challengeId);

      const cred = creds.find(c => c.id === body.response?.id);
      if (!cred) return json({ error: api.credNotFound }, 400);

      const origin = originFromRequest(req);
      if (!isAllowedOrigin(origin)) return json({ error: api.originDenied }, 400);

      try {
        const verification = await verifyAuthenticationResponse({
          response: body.response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: origin,
          expectedRPID: RP_ID,
          credential: {
            id: cred.id,
            publicKey: b64uToBuf(cred.publicKey),
            counter: cred.counter,
            transports: cred.transports as any,
          },
          requireUserVerification: true,
        });
        if (!verification.verified) return json({ error: api.verifyFailed }, 401);

        // A counter that goes backwards means the credential may have been
        // cloned. Authenticators that never increment report 0, so only enforce
        // this once a credential has reported a real counter.
        const nextCounter = verification.authenticationInfo.newCounter;
        if (cred.counter > 0 && nextCounter <= cred.counter) {
          addAudit({
            actor: "owner",
            action: "login_counter_regression",
            target: cred.id,
            ip: clientIp(req),
            ua: req.headers.get("user-agent") || undefined,
          });
          return json({ error: api.verifyFailed }, 401);
        }

        updateCredentialCounter(cred.id, nextCounter);

        const token = createSession("owner", "all", Date.now() + OWNER_TTL_MS);
        auditRequest(req, "owner", "login");
        return json({ ok: true, redirect: safeNext(body.next) }, 200, { "set-cookie": ownerCookie(token) });
      } catch (e: any) {
        return json({ error: e?.message || String(e) }, 400);
      }
    }

    // --- passkey registration ---
    if (path === "/api/webauthn/register/options" && req.method === "POST") {
      const creds = loadCreds();
      const invite = findByToken(url.searchParams.get("token") || "");
      if (!invite || invite.type !== "passkey" || inviteState(invite) !== "active") {
        return json({ error: api.inviteInvalid }, 403);
      }

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: OWNER_NAME,
        userDisplayName: OWNER_NAME,
        attestationType: "none",
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        excludeCredentials: creds.map(c => ({ id: c.id, transports: c.transports as any })),
      });
      const cid = bufToB64u(randomBytes(16));
      challenges.set(cid, { challenge: options.challenge, type: "reg", expires: Date.now() + CHALLENGE_TTL_MS });
      return json({ options, challengeId: cid });
    }

    if (path === "/api/webauthn/register/verify" && req.method === "POST") {
      const body = await req.json() as any;
      const challenge = challenges.get(body.challengeId);
      if (!challenge || challenge.type !== "reg" || challenge.expires < Date.now()) {
        return json({ error: api.challengeInvalid }, 400);
      }
      challenges.delete(body.challengeId);

      const claim = claimPasskeyInvite(body.token || "");
      if (!claim) return json({ error: api.inviteInvalid }, 403);

      const origin = originFromRequest(req);
      if (!isAllowedOrigin(origin)) {
        releasePasskeyClaim(claim.invite.id, claim.claimId);
        return json({ error: api.originDenied }, 400);
      }

      try {
        const verification = await verifyRegistrationResponse({
          response: body.response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: origin,
          expectedRPID: RP_ID,
          requireUserVerification: true,
        });
        if (!verification.verified || !verification.registrationInfo) {
          releasePasskeyClaim(claim.invite.id, claim.claimId);
          return json({ error: api.verifyFailed }, 400);
        }
        const { credential } = verification.registrationInfo;
        addCredential({
          id: credential.id,
          publicKey: bufToB64u(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports,
          createdAt: new Date().toISOString(),
        });
        finalizePasskeyInvite(claim.invite.id, claim.claimId);
        auditRequest(req, "owner", "passkey_register", credential.id);
        return json({ ok: true });
      } catch (e: any) {
        releasePasskeyClaim(claim.invite.id, claim.claimId);
        return json({ error: e?.message || String(e) }, 400);
      }
    }

    return new Response("Not found", { status: 404, headers: BASE_HEADERS });
  },
});

cleanupSessions();
pruneAudit(Date.now() - AUDIT_RETENTION_MS);
setInterval(() => {
  cleanupSessions();
  pruneAudit(Date.now() - AUDIT_RETENTION_MS);
  sweepRateBuckets();
}, 10 * 60_000).unref?.();

console.log(`Limen listening on 127.0.0.1:${PORT}`);
console.log(`RP_ID=${RP_ID} ADMIN_DEV_OPEN=${DEV_OPEN ? "on" : "off"}`);
