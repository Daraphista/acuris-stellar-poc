/** Node-only synchronous SHA-256. See hash-web.ts for the browser (async) equivalent. */
import { createHash } from "node:crypto";

export function sha256Sync(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}
