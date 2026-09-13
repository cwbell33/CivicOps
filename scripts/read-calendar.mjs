#!/usr/bin/env node
/**
 * Print upcoming events from one or more public iCalendar (.ics) feeds.
 *
 * Usage:  node scripts/read-calendar.mjs <ics-url> [more-ics-urls...] [--days=42]
 *
 * Prints JSON: { "events": [...], "errors": [...] }. Events are sorted by start
 * time, with dates and times in Pacific time; time is "" for all-day events.
 *
 * Repeating events are expanded, rescheduled occurrences use their new date,
 * and cancelled occurrences are skipped. Read the raw feed with this rather
 * than Google Calendar's embedded agenda view: that view files evening events
 * under the next day for some calendars.
 */

import ICAL from "ical.js";

const TZ = "America/Los_Angeles";
const MAX_OCCURRENCES_PER_SERIES = 10_000;

const pacificDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const pacificTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

function pad(n) {
  return String(n).padStart(2, "0");
}

function cleanText(value, maxLength) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function isCancelled(event) {
  return String(event.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED";
}

function toRecord(event, start) {
  const base = {
    title: cleanText(event.summary, 200),
    location: cleanText(event.location, 200),
    description: cleanText(event.description, 400),
  };
  if (start.isDate) {
    return { date: `${start.year}-${pad(start.month)}-${pad(start.day)}`, time: "", sortKey: Date.UTC(start.year, start.month - 1, start.day), ...base };
  }
  const instant = start.toJSDate();
  return { date: pacificDate.format(instant), time: pacificTime.format(instant), sortKey: instant.getTime(), ...base };
}

async function readFeed(url, windowStart, windowEnd, todayPacific) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const root = new ICAL.Component(ICAL.parse(await res.text()));

  // Without its VTIMEZONE registered, a TZID time is misread as floating.
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  const masters = new Map();
  const exceptions = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  const orphans = [];
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else orphans.push(exception);
  }

  const records = [];
  const consider = (event, start) => {
    if (isCancelled(event)) return;
    const record = toRecord(event, start);
    if (record.date >= todayPacific && start.compare(windowEnd) <= 0) records.push(record);
  };

  for (const event of [...masters.values(), ...orphans]) {
    if (isCancelled(event) && !event.isRecurring()) continue;
    if (!event.isRecurring()) {
      consider(event, event.startDate);
      continue;
    }
    const occurrences = event.iterator();
    let next;
    let count = 0;
    while ((next = occurrences.next()) && count++ < MAX_OCCURRENCES_PER_SERIES) {
      if (next.compare(windowEnd) > 0) break;
      if (next.compare(windowStart) < 0) continue;
      const details = event.getOccurrenceDetails(next);
      consider(details.item, details.startDate);
    }
  }
  return records;
}

async function main() {
  const args = process.argv.slice(2);
  const daysArg = args.find((a) => a.startsWith("--days="));
  const days = daysArg ? Number(daysArg.slice("--days=".length)) : 42;
  const urls = args.filter((a) => !a.startsWith("--"));

  if (!urls.length || !Number.isFinite(days) || days <= 0) {
    console.error("Usage: node scripts/read-calendar.mjs <ics-url> [more-ics-urls...] [--days=42]");
    process.exit(1);
  }

  const now = new Date();
  const todayPacific = pacificDate.format(now);
  // A day of slack on each side; exact filtering happens on the Pacific date.
  const windowStart = ICAL.Time.fromJSDate(new Date(now.getTime() - 86_400_000), true);
  const windowEnd = ICAL.Time.fromJSDate(new Date(now.getTime() + days * 86_400_000), true);

  const events = [];
  const errors = [];
  for (const url of urls) {
    try {
      events.push(...(await readFeed(url, windowStart, windowEnd, todayPacific)));
    } catch (err) {
      errors.push({ url, error: err.message });
    }
  }

  const seen = new Set();
  const unique = events
    .sort((a, b) => a.sortKey - b.sortKey)
    .filter((e) => {
      const key = `${e.title.toLowerCase()}|${e.date}|${e.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ sortKey, ...rest }) => rest);

  console.log(JSON.stringify({ events: unique, errors }, null, 2));
  if (!unique.length && errors.length === urls.length) process.exit(1);
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(1);
});
