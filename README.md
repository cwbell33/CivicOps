# CivicOps

Community engagement tool for aggregating events for local politics — built for CNL Seattle to surface upcoming housing, transit, and civic events across the Puget Sound region.

The public site shows a shared list of upcoming events that you can filter, select, and hand off to your chapter chair as a calendar file or email summary.

## How it works

- **The public site is display-only.** Visitors can browse and export events, but nothing on the site can change the list or spend money.
- **Events are refreshed locally.** A scheduled task in the Claude desktop app checks daily whether a refresh has succeeded in the last 7 days. If not, it reads the verified source calendars in `lib/sources.js`, keeps events relevant to CNL Seattle, and pushes them to shared storage. This runs under a Claude subscription, not API credits.
- Results are deduplicated and merged into one shared list, so nothing is lost between runs.

## Scripts

All three read `BLOB_READ_WRITE_TOKEN` from `.env.local` and work from any directory.

| Script | What it does |
| --- | --- |
| `node scripts/refresh-status.mjs` | Reports `FRESH` or `STALE` against a 7-day window. |
| `node scripts/read-calendar.mjs <ics-url> [...]` | Prints upcoming events from `.ics` feeds, with repeating and rescheduled events worked out in Pacific time. |
| `node scripts/push-events.mjs events.json` | Merges events into the shared list and records a successful refresh. The expected event shape is documented at the top of the file. |

## Sources

`lib/sources.js` lists each organization with a `url` (the page a person opens, shown under **Quick links**) and, where one can be read automatically, a `checkUrl` (what the refresh reads). The comment at the top of the file explains the fields.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run the refresh scripts, add a read-write token to `.env.local` (never committed to git):

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Get it from the Vercel dashboard under **Storage → your Blob store**. The OIDC credentials Vercel injects automatically only work inside Vercel's functions; code on your own machine needs this static token. It grants write access to the live list, so keep it private.

## Deployment (Vercel)

1. Import this repo into [Vercel](https://vercel.com/new).
2. In the project's **Storage** tab, create a **Blob** store (access: Private) and connect it to this project. This is where the shared event list lives; the deployed site reads it using OIDC, with no token to configure.
3. Deploy.

`app/api/cron/refresh-events` is left over from an earlier API-based search. It is no longer scheduled, and only runs if called with `CRON_SECRET`.

## Tech stack

Next.js (App Router) + Tailwind CSS v4, Vercel Blob for shared storage, ical.js for reading calendar feeds, and a Claude desktop app scheduled task for refreshes.
