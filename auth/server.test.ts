import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";

// Each run gets its own database, its own invite secret, and a port that the
// live service never uses.
process.env.AUTH_DATA_DIR = mkdtempSync(join(tmpdir(), "limen-server-test-"));
process.env.PORT = "18099";

const { server } = await import("./server.ts");
const store = await import("./store.ts");
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
  expect(res.headers.get("location")).toContain("https://auth.example.com/login?next=");
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
  const cookie = (redeem.headers.get("set-cookie") || "").split(";")[0];
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
  expect(await res.text()).toContain("Port ini tidak tersedia");
});

test("the API rate limit kicks in after 60 requests", async () => {
  let last = 0;
  for (let i = 0; i < 62; i += 1) {
    const res = await fetch(`${base}/api/webauthn/login/options`, { method: "POST" });
    last = res.status;
  }
  expect(last).toBe(429);
});
