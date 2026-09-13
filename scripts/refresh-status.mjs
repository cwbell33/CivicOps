#!/usr/bin/env node
/**
 * Report whether the event list has been refreshed recently.
 *
 * Usage:  node scripts/refresh-status.mjs
 *
 * Prints one line starting with FRESH or STALE, and exits with:
 *   0  FRESH  a refresh succeeded within the last 7 days
 *   2  STALE  no successful refresh in 7+ days, or none on record
 *   1  ERROR  couldn't check (missing token, storage unreachable)
 */

import { get } from "@vercel/blob";
import { STATUS_PATHNAME, die, loadToken } from "./_shared.mjs";

const STALE_AFTER_DAYS = 7;

const token = loadToken();

let status = null;
try {
  const result = await get(STATUS_PATHNAME, { access: "private", useCache: false, token });
  if (result && result.statusCode === 200 && result.stream) {
    status = JSON.parse(await new Response(result.stream).text());
  }
} catch (err) {
  die(`Couldn't read refresh status from storage.\n  ${err.message}`, 1);
}

if (!status?.lastSuccessAt) {
  console.log("STALE: no successful refresh on record.");
  process.exit(2);
}

const last = new Date(status.lastSuccessAt);
const daysAgo = (Date.now() - last.getTime()) / 86_400_000;
const summary =
  `last successful refresh ${daysAgo.toFixed(1)} days ago (${last.toISOString()}), ` +
  `${status.total} event(s) stored`;

if (daysAgo >= STALE_AFTER_DAYS) {
  console.log(`STALE: ${summary}`);
  process.exit(2);
}
console.log(`FRESH: ${summary}`);
