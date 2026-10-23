import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

process.env.AUTH_DATA_DIR = mkdtempSync(join(tmpdir(), "limen-store-test-"));
const store = await import("../src/store.ts");

test("an access invite can be consumed more than once", () => {
  const invite = store.createInvite({
    type: "access",
    label: "tim desain",
    durationMs: store.durationMs(1, "hours"),
    scope: [4322, 4323],
  });
  const token = store.inviteToken(invite);

  expect(store.findByToken(token)?.id).toBe(invite.id);
  expect(store.consumeAccessInvite(token)?.uses).toBe(1);
  expect(store.consumeAccessInvite(token)?.uses).toBe(2);
  expect(store.inviteState(store.findByToken(token)!)).toBe("active");
});

test("a token with a bad signature is rejected", () => {
  const invite = store.createInvite({ type: "access", label: "", durationMs: 60_000, scope: "all" });
  expect(store.findByToken(`${invite.id}.not-the-signature`)).toBeNull();
  expect(store.findByToken(invite.id)).toBeNull();
  expect(store.consumeAccessInvite(`${invite.id}.not-the-signature`)).toBeNull();
});

test("revoking an access invite stops redemption and kills its guest sessions", () => {
  const invite = store.createInvite({ type: "access", label: "", durationMs: 3_600_000, scope: "all" });
  const token = store.inviteToken(invite);
  const session = store.createSession("guest", "all", Date.now() + 60_000, invite.id);

  expect(store.getSession(session)).not.toBeNull();
  store.revokeInvite(invite.id);

  expect(store.consumeAccessInvite(token)).toBeNull();
  expect(store.inviteState(store.findByToken(token)!)).toBe("revoked");
  expect(store.getSession(session)).toBeNull();
});

test("a passkey invite can only be claimed, finalized, and used once", () => {
  const invite = store.createInvite({ type: "passkey", label: "", durationMs: 60_000, scope: "all" });
  const token = store.inviteToken(invite);

  const claim = store.claimPasskeyInvite(token);
  expect(claim).not.toBeNull();
  expect(store.claimPasskeyInvite(token)).toBeNull();

  expect(store.finalizePasskeyInvite(invite.id, claim!.claimId)).toBe(true);
  expect(store.findByToken(token)!.uses).toBe(1);
  expect(store.claimPasskeyInvite(token)).toBeNull();
});

test("releasing a claim makes the passkey invite usable again", () => {
  const invite = store.createInvite({ type: "passkey", label: "", durationMs: 60_000, scope: "all" });
  const token = store.inviteToken(invite);

  const first = store.claimPasskeyInvite(token)!;
  store.releasePasskeyClaim(invite.id, first.claimId);

  const second = store.claimPasskeyInvite(token);
  expect(second).not.toBeNull();
  expect(second!.claimId).not.toBe(first.claimId);
});

test("sessions round trip and expire", () => {
  const token = store.createSession("guest", [4322], Date.now() + 60_000);
  expect(store.getSession(token)?.scope).toEqual([4322]);

  store.deleteSession(token);
  expect(store.getSession(token)).toBeNull();

  const expired = store.createSession("owner", "all", Date.now() - 1_000);
  expect(store.getSession(expired)).toBeNull();
});

test("blocked ports survive a read and can be turned back on", () => {
  store.setPortBlocked(9999, true);
  expect(store.loadBlockedPorts().has(9999)).toBe(true);

  store.setPortBlocked(9999, false);
  expect(store.loadBlockedPorts().has(9999)).toBe(false);
});

test("guest sessions for one invite are trimmed to the newest ones", () => {
  const invite = store.createInvite({ type: "access", label: "", durationMs: 3_600_000, scope: "all" });
  for (let i = 0; i < 25; i += 1) {
    store.createSession("guest", "all", Date.now() + 600_000, invite.id);
  }

  store.trimInviteSessions(invite.id, 20);
  expect(store.listSessions().filter((s) => s.inviteId === invite.id).length).toBe(20);
});

test("audit pruning only drops rows older than the cutoff", () => {
  store.addAudit({ actor: "owner", action: "test_old" });
  store.pruneAudit(Date.now() - 60_000);
  expect(store.listAudit(100).some((row) => row.action === "test_old")).toBe(true);

  store.pruneAudit(Date.now() + 1_000);
  expect(store.listAudit(100).length).toBe(0);
});
