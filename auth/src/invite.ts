import {
  createInvite,
  durationMs,
  inviteToken,
  UNITS,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  type Unit,
} from "./store.ts";
import { AUTH_ORIGIN, TZ } from "./config.ts";

const BASE_URL = AUTH_ORIGIN;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const type = arg("type") === "access" ? "access" : "passkey";
const amount = Number(arg("duration") || (type === "passkey" ? 15 : 24));
const unit = (arg("unit") || "minutes") as Unit;
const label = arg("label") || "";
const rawScope = arg("scope") || "all";

if (!UNITS.includes(unit)) {
  console.error(`Unknown unit. Choose one of: ${UNITS.join(", ")}`);
  process.exit(1);
}

const ms = durationMs(amount, unit);
if (!Number.isInteger(amount) || amount < 1 || ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) {
  console.error("Duration must be between 1 minute and 12 months.");
  process.exit(1);
}

let scope: "all" | number[] = "all";
if (type === "access" && rawScope !== "all") {
  const ports = rawScope.split(/[,\s]+/).filter(Boolean).map(Number);
  const unique = [...new Set(ports)];
  if (unique.length === 0 || unique.some(p => !Number.isInteger(p) || p < 1 || p > 65535)) {
    console.error("Invalid port scope. Example: --scope 4322,4323 or --scope all");
    process.exit(1);
  }
  scope = unique.sort((a, b) => a - b);
}

const invite = createInvite({ type, label, durationMs: ms, scope });
const url = `${BASE_URL}${type === "access" ? "/access" : "/register"}?token=${inviteToken(invite)}`;

console.log("");
console.log(type === "access" ? "Limen · temporary access invite:" : "Limen · passkey invite:");
console.log("");
console.log(`  ${url}`);
console.log("");
console.log(`Valid until ${new Date(invite.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ })}.`);
console.log(type === "access" ? `Scope: ${invite.scope === "all" ? "all ports" : invite.scope.join(", ")}.` : "Single use.");
console.log("");
