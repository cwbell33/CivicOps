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
 * category is one of: Volunteering | Political | Community Outreach
 * issue is one of:    Housing | Transit | General
 *
 * New events are merged into whatever is already stored; anything matching an
 * existing title + date is skipped, so running this twice is harmless.
 *
 * Every successful run, including one that adds nothing new, records its time
 * in storage. scripts/refresh-status.mjs reads that record.
 */

import { readFileSync } from "node:fs";
import { get, put } from "@vercel/blob";
import { EVENTS_PATHNAME, STATUS_PATHNAME, die, loadToken } from "./_shared.mjs";

function eventKey(event) {
  return `${(event.title || "").toLowerCase().trim()}|${event.date || ""}`;
}

function byDate(a, b) {
  return (a.date || "9999").localeCompare(b.date || "9999");
}

async function readExisting(token) {
  const result = await get(EVENTS_PATHNAME, { access: "private", useCache: false, token });
  // A store with nothing written yet is expected, not an error.
  if (!result || result.statusCode !== 200 || !result.stream) return [];
  const parsed = JSON.parse(await new Response(result.stream).text());
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJson(pathname, value, token) {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    token,
  });
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    die("No file given.\n  Usage: node scripts/push-events.mjs <path-to-json-file>");
  }

  const token = loadToken();

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
  const merged = fresh.length ? [...existing, ...fresh].sort(byDate) : existing;

  try {
    if (fresh.length) await writeJson(EVENTS_PATHNAME, merged, token);
    await writeJson(
      STATUS_PATHNAME,
      { lastSuccessAt: new Date().toISOString(), added: fresh.length, total: merged.length },
      token
    );
  } catch (err) {
    die(`Write to storage failed.\n  ${err.message}`);
  }

  if (!fresh.length) {
    console.log("\n✓ Nothing new — every event was already stored. Refresh recorded.\n");
    return;
  }
  console.log(
    `\n✓ Added ${fresh.length} new event(s). Storage now holds ${merged.length}.\n` +
      `  Reload the live site to see them.\n`
  );
}

main().catch((err) => die(err.message));
