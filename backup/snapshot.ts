import { Database } from "bun:sqlite";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: snapshot.ts <source.db> <destination.db>");
  process.exit(2);
}

const source = new Database(src, { readonly: true });
source.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`);
source.close();

const check = new Database(dest, { readonly: true });
const row = check.query("PRAGMA integrity_check").get() as Record<string, string>;
const integrity = Object.values(row)[0];
if (String(integrity).toLowerCase() !== "ok") {
  console.error(`integrity check failed: ${integrity}`);
  check.close();
  process.exit(1);
}
check.close();
console.log(dest);
