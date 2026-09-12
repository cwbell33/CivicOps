#!/usr/bin/env node
/**
 * Push a list of events into the app's shared storage.
 *
 * Usage:  node scripts/push-events.mjs <path-to-json-file>
 *
 * The JSON file may be either a bare array of events, or an object shaped
 * like { "events": [ ... ] }. Each event should look like:
 *
 *   {
 *     "title": "Seattle City Council — Land Use Committee",
 *     "date": "2026-09-24",
 *     "time": "9:30 AM",
 *     "location": "City Hall, 600 4th Ave",
 *     "category": "Political",
 *     "issue": "Housing",
 *     "why": "Comprehensive plan upzone discussion",
 *     "source": "Seattle City Council",
 *     "url": "https://..."
 *   }
 *
 * New events are merged into whatever is already stored; anything matching an
 * existing title + date is skipped, so running this twice is harmless.
 */

import { readFileSync } from "node:fs";
import { get, put } from "@vercel/blob";

const EVENTS_PATHNAME = "cnl-events.json";
const ENV_FILE = ".env.local";

function die(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Minimal .env.local reader so this runs with a plain `node` invocation. */
function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(new URL(`../${ENV_FILE}`, import.meta.url), "utf8");
  } catch {
    return; // No .env.local is fine if the token is already in the environment.
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function eventKey(event) {
  return `${(event.title || "").toLowerCase().trim()}|${event.date || ""}`;
}

function byDate(a, b) {
  return (a.date || "9999").localeCompare(b.date || "9999");
}

async function readExisting(token) {
  const result = await get(EVENTS_PATHNAME, {
    access: "private",
    useCache: false,
    token,
  });
  // A store with nothing written yet is expected, not an error.
  if (!result || result.statusCode !== 200 || !result.stream) return [];
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [];
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    die("No file given.\n  Usage: node scripts/push-events.mjs <path-to-json-file>");
  }

  loadEnvLocal();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    die(
      `No BLOB_READ_WRITE_TOKEN found.\n` +
        `  Add it to ${ENV_FILE}:  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...\n` +
        `  Get it from the Vercel dashboard under Storage > your Blob store.`
    );
  }

  let fileContents;
  try {
    fileContents = readFileSync(inputPath, "utf8");
  } catch {
    die(`Couldn't read "${inputPath}". Check the path and try again.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fileContents);
  } catch (err) {
    die(`"${inputPath}" isn't valid JSON.\n  ${err.message}`);
  }

  const incoming = Array.isArray(parsed) ? parsed : parsed?.events;
  if (!Array.isArray(incoming)) {
    die(`Expected a JSON array of events, or an object with an "events" array.`);
  }

  const valid = incoming.filter((e) => e && typeof e.title === "string" && e.title.trim());
  const skipped = incoming.length - valid.length;
  if (!valid.length) die("No usable events in that file (every entry was missing a title).");

  console.log(`Read ${valid.length} event(s) from ${inputPath}.`);
  if (skipped) console.log(`  (skipped ${skipped} entry/entries with no title)`);

  let existing;
  try {
    existing = await readExisting(token);
  } catch (err) {
    die(`Couldn't read current events from storage.\n  ${err.message}`);
  }
  console.log(`Storage currently holds ${existing.length} event(s).`);

  const existingKeys = new Set(existing.map(eventKey));
  const fresh = valid.filter((e) => !existingKeys.has(eventKey(e)));

  if (!fresh.length) {
    console.log("\n✓ Nothing new — every event was already stored. Left storage unchanged.\n");
    return;
  }

  const merged = [...existing, ...fresh].sort(byDate);

  try {
    await put(EVENTS_PATHNAME, JSON.stringify(merged), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      token,
    });
  } catch (err) {
    die(`Write to storage failed.\n  ${err.message}`);
  }

  console.log(
    `\n✓ Added ${fresh.length} new event(s). Storage now holds ${merged.length}.\n` +
      `  Reload the live site to see them.\n`
  );
}

main().catch((err) => die(err.message));
