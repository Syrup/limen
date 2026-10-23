import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";

// Each run gets its own database, its own invite secret, and a port that the
// live service never uses.
process.env.AUTH_DATA_DIR = mkdtempSync(join(tmpdir(), "limen-server-test-"));
process.env.PORT = "18099";
process.env.LIMEN_DOMAIN = "limen.test";
process.env.LIMEN_AUTH_HOST = "auth.limen.test";
process.env.LIMEN_TZ = "UTC";

const { server } = await import("../src/server.ts");
const store = await import("../src/store.ts");
const base = `http://127.0.0.1:${server.port}`;

afterAll(() => server.stop(true));

test("health answers", async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("a malformed session cookie does not turn into a 500", async () => {
  const res = await fetch(`${base}/login`, { headers: { cookie: "ag_session=%" } });
  expect(res.status).toBe(200);
});

test("the login page carries the security headers", async () => {
  const res = await fetch(`${base}/login`);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("x-frame-options")).toBe("DENY");

  const csp = res.headers.get("content-security-policy") || "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("'sha256-");
  expect(csp).not.toContain("unsafe-eval");
});

test("the dashboard allows the eval that Alpine and htmx need", async () => {
  const token = store.createSession("owner", "all", Date.now() + 60_000);
  const cookie = `ag_session=${token}`;

  const page = await fetch(`${base}/admin`, { headers: { cookie } });
  expect(page.status).toBe(200);
  expect(page.headers.get("content-security-policy") || "").toContain("'unsafe-eval'");

  const ports = await fetch(`${base}/fragments/ports`, { headers: { cookie } });
  expect(ports.status).toBe(200);
});

test("the dashboard and its fragments stay closed without a session", async () => {
  const admin = await fetch(`${base}/admin`, { redirect: "manual" });
  expect(admin.status).toBe(302);
  expect(admin.headers.get("location")).toContain("/login?next=%2Fadmin");

  expect((await fetch(`${base}/fragments/invites`)).status).toBe(404);
});

test("an unauthenticated port request is sent to the login page", async () => {
  const res = await fetch(`${base}/verify`, {
    headers: { "x-port": "4322" },
    redirect: "manual",
  });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("https://auth.limen.test/login?next=");
});

test("a guest session only passes the ports in its scope", async () => {
  const invite = store.createInvite({
    type: "access",
    label: "scope test",
    durationMs: 3_600_000,
    scope: [5001],
  });
  const token = store.inviteToken(invite);

  const redeem = await fetch(`${base}/access?token=${encodeURIComponent(token)}`, { redirect: "manual" });
  expect(redeem.status).toBe(302);
  const cookie = (redeem.headers.get("set-cookie") || "").split(";")[0] ?? "";
  expect(cookie).toContain("ag_access=");

  expect((await fetch(`${base}/verify`, { headers: { "x-port": "5001", cookie } })).status).toBe(200);
  expect((await fetch(`${base}/verify`, { headers: { "x-port": "5002", cookie } })).status).toBe(403);
});

test("a blocked port is refused even for the owner", async () => {
  store.setPortBlocked(5003, true);
  const token = store.createSession("owner", "all", Date.now() + 60_000);

  const res = await fetch(`${base}/verify`, {
    headers: { "x-port": "5003", cookie: `ag_session=${token}` },
  });
  expect(res.status).toBe(403);
  expect(await res.text()).toContain("This port is unavailable");
});

test("opening an access link again in the same browser reuses the session", async () => {
  const invite = store.createInvite({ type: "access", label: "reuse", durationMs: 3_600_000, scope: "all" });
  const url = `${base}/access?token=${encodeURIComponent(store.inviteToken(invite))}`;

  const first = await fetch(url, { redirect: "manual" });
  expect(first.status).toBe(302);
  const cookie = (first.headers.get("set-cookie") || "").split(";")[0] ?? "";
  const before = store.listSessions().filter((s) => s.inviteId === invite.id).length;

  const again = await fetch(url, { redirect: "manual", headers: { cookie } });
  expect(again.status).toBe(302);
  expect(again.headers.get("set-cookie")).toBeNull();
  expect(store.listSessions().filter((s) => s.inviteId === invite.id).length).toBe(before);
});

test("one access link cannot grow the session table without bound", async () => {
  const invite = store.createInvite({ type: "access", label: "cap", durationMs: 3_600_000, scope: "all" });
  const url = `${base}/access?token=${encodeURIComponent(store.inviteToken(invite))}`;

  for (let i = 0; i < 22; i += 1) {
    const res = await fetch(url, { redirect: "manual" });
    expect(res.status).toBe(302);
  }

  expect(store.listSessions().filter((s) => s.inviteId === invite.id).length).toBe(20);
});

test("admin writes only accept the auth origin", async () => {
  const token = store.createSession("owner", "all", Date.now() + 60_000);
  const body = new URLSearchParams({ type: "access", amount: "1", unit: "hours", scope: "all", label: "csrf" });
  const form = { "content-type": "application/x-www-form-urlencoded" };

  const foreign = await fetch(`${base}/admin/invites`, {
    method: "POST",
    headers: { ...form, cookie: `ag_session=${token}`, origin: "https://p4323.limen.test" },
    body,
  });
  expect(foreign.status).toBe(403);

  const own = await fetch(`${base}/admin/invites`, {
    method: "POST",
    headers: { ...form, cookie: `ag_session=${token}`, origin: "https://auth.limen.test" },
    body,
  });
  expect(own.status).toBe(200);

  const cli = await fetch(`${base}/admin/invites`, {
    method: "POST",
    headers: { ...form, cookie: `ag_session=${token}` },
    body,
  });
  expect(cli.status).toBe(200);
});

test("the API rate limit kicks in after 60 requests", async () => {
  let last = 0;
  for (let i = 0; i < 62; i += 1) {
    const res = await fetch(`${base}/api/webauthn/login/options`, { method: "POST" });
    last = res.status;
  }
  expect(last).toBe(429);
});
