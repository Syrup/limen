import { Database } from "bun:sqlite";

const path = process.argv[2];
if (!path) {
  console.error("usage: verify-db.ts <auth.db>");
  process.exit(2);
}

const db = new Database(path, { readonly: true });
const row = db.query("PRAGMA integrity_check").get() as Record<string, string>;
const integrity = Object.values(row)[0];
if (String(integrity).toLowerCase() !== "ok") {
  console.error(`integrity check failed: ${integrity}`);
  process.exit(1);
}

const tables = ["credentials", "invites", "sessions", "blocked_ports", "audit_log"] as const;
const counts: Record<string, number> = {};
for (const table of tables) {
  counts[table] = (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as any).n;
}
db.close();

console.log(JSON.stringify({ integrity: "ok", counts }));
