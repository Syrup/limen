/**
 * Container healthcheck: ask the auth service about its own health.
 * Runs inside the image, so it reads the same port the server binds.
 */
import { PORT } from "./config.ts";

const res = await fetch(`http://127.0.0.1:${PORT}/health`).catch(() => null);
process.exit(res && res.ok ? 0 : 1);
