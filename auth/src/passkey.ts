import { loadCreds, removeCredential } from "./store.ts";

const [command, id] = process.argv.slice(2);

if (!command || command === "list") {
  const creds = loadCreds();
  if (creds.length === 0) {
    console.log("No passkeys registered.");
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
    console.error(`passkey not found: ${id}`);
    process.exit(1);
  }
  if (creds.length === 1) {
    console.warn("WARNING: this is the last passkey. After removal there is no way in until a new one is registered through an invite.");
  }
  removeCredential(id);
  console.log(`Removed passkey ${id}. All owner sessions revoked.`);
  process.exit(0);
}

console.error("usage: bun run passkey.ts [list|remove <id>]");
process.exit(2);
