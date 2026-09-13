import { readFileSync } from "node:fs";

export const EVENTS_PATHNAME = "cnl-events.json";
export const STATUS_PATHNAME = "refresh-status.json";

export function die(message, exitCode = 1) {
  console.error(`\n✖ ${message}\n`);
  process.exit(exitCode);
}

/**
 * Reads BLOB_READ_WRITE_TOKEN from the environment, falling back to the
 * project's .env.local. Resolved relative to this file, not the working
 * directory, so the scripts work when launched from anywhere.
 */
export function loadToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
      const match = raw.match(/^\s*BLOB_READ_WRITE_TOKEN\s*=\s*(.*?)\s*$/m);
      if (match) process.env.BLOB_READ_WRITE_TOKEN = match[1].replace(/^["']|["']$/g, "");
    } catch {
      // No .env.local; fall through to the error below.
    }
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    die(
      "No BLOB_READ_WRITE_TOKEN found.\n" +
        "  Add it to .env.local:  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...\n" +
        "  Get it from the Vercel dashboard under Storage > your Blob store."
    );
  }
  return token;
}
