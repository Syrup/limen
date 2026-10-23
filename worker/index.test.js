import { expect, test } from "bun:test";

const worker = (await import("./index.js")).default;
const env = { LIMEN_DOMAIN: "example.com", LIMEN_AUTH_HOST: "auth.example.com" };

async function statusFor(host, environment = env) {
  const res = await worker.fetch(new Request(`https://${host}/`), environment);
  return res.status;
}

test("blocks hosts outside the zone", async () => {
  expect(await statusFor("unknown.example.com")).toBe(404);
  expect(await statusFor("pabc.example.com")).toBe(404);
  expect(await statusFor("p00.example.com")).toBe(404);
  expect(await statusFor("evil.test")).toBe(404);
});

test("blocks a lookalike domain", async () => {
  expect(await statusFor("p4323.exampleXcom")).toBe(404);
  expect(await statusFor("p4323.example.com.evil.test")).toBe(404);
});

test("passes the apex, the auth host, and port hosts through", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("origin");
  try {
    for (const host of ["example.com", "auth.example.com", "p4323.example.com", "p65535.example.com"]) {
      expect(await statusFor(host)).toBe(200);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("fails closed when the deployment values are missing", async () => {
  expect(await statusFor("p4323.example.com", {})).toBe(404);
});
