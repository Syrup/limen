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
  console.error(`Unit tidak dikenal. Pilih: ${UNITS.join(", ")}`);
  process.exit(1);
}

const ms = durationMs(amount, unit);
if (!Number.isInteger(amount) || amount < 1 || ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) {
  console.error("Durasi harus antara 1 menit dan 12 bulan.");
  process.exit(1);
}

let scope: "all" | number[] = "all";
if (type === "access" && rawScope !== "all") {
  const ports = rawScope.split(/[,\s]+/).filter(Boolean).map(Number);
  const unique = [...new Set(ports)];
  if (unique.length === 0 || unique.some(p => !Number.isInteger(p) || p < 1 || p > 65535)) {
    console.error("Scope port tidak valid. Contoh: --scope 4322,4323 atau --scope all");
    process.exit(1);
  }
  scope = unique.sort((a, b) => a - b);
}

const invite = createInvite({ type, label, durationMs: ms, scope });
const url = `${BASE_URL}${type === "access" ? "/access" : "/register"}?token=${inviteToken(invite)}`;

console.log("");
console.log(type === "access" ? "Limen · invite akses sementara:" : "Limen · invite passkey:");
console.log("");
console.log(`  ${url}`);
console.log("");
console.log(`Berlaku sampai ${new Date(invite.expiresAt).toLocaleString("id-ID", { timeZone: TZ })}.`);
console.log(type === "access" ? `Cakupan: ${invite.scope === "all" ? "semua port" : invite.scope.join(", ")}.` : "Sekali pakai.");
console.log("");
