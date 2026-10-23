import { loadCreds, removeCredential } from "./store.ts";

const [command, id] = process.argv.slice(2);

if (!command || command === "list") {
  const creds = loadCreds();
  if (creds.length === 0) {
    console.log("Belum ada passkey terdaftar.");
    process.exit(0);
  }
  for (const cred of creds) {
    console.log(`${cred.id}  ${cred.createdAt}  counter=${cred.counter}`);
  }
  process.exit(0);
}

if (command === "remove") {
  if (!id) {
    console.error("usage: bun run passkey.ts remove <id>");
    process.exit(2);
  }
  const creds = loadCreds();
  if (!creds.some(c => c.id === id)) {
    console.error(`passkey tidak ditemukan: ${id}`);
    process.exit(1);
  }
  if (creds.length === 1) {
    console.warn("PERINGATAN: ini passkey terakhir. Setelah dihapus, tidak ada cara masuk sampai passkey baru didaftarkan lewat invite.");
  }
  removeCredential(id);
  console.log(`Passkey ${id} dihapus. Semua sesi owner dicabut.`);
  process.exit(0);
}

console.error("usage: bun run passkey.ts [list|remove <id>]");
process.exit(2);
