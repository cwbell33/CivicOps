# CivicOps

Community engagement tool for aggregating events for local politics — built for CNL Seattle to surface upcoming housing, transit, and civic events across the Puget Sound region.

It uses Claude (with web search) to scout trusted local sources for real, upcoming events, then lets you review, filter, and hand off a curated list to your chapter chair as a calendar file or email summary.

## How it works

- **Manual search**: click "Find Events" in the app to run a search on demand.
- **Weekly auto-refresh**: a scheduled job (see [Deployment](#deployment)) runs the same search automatically and shares results with every visitor.
- Results are deduplicated and merged into one shared list — nothing is lost between runs.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a `.env.local` file (not committed to git) with:

```
ANTHROPIC_API_KEY=your-key-from-console.anthropic.com
CRON_SECRET=any-random-string
```

Without an Anthropic API key, the app still loads but "Find Events" will show a clear error instead of crashing. Without a connected Vercel Blob store (see below), events aren't shared across visitors — the app still works locally, it just won't persist the shared list.

## Deployment (Vercel)

1. Import this repo into [Vercel](https://vercel.com/new).
2. Add `ANTHROPIC_API_KEY` and `CRON_SECRET` as Environment Variables in the project settings.
3. In the project's **Storage** tab, create a **Blob** store (access: Private) and connect it to this project — this is where the shared event list lives.
4. Deploy. The weekly cron job (`vercel.json`, `/api/cron/refresh-events`) registers itself automatically and is protected by `CRON_SECRET`, so only Vercel's scheduler can trigger it.

## Tech stack

Next.js (App Router) + Tailwind CSS v4, Claude API (web search tool) via a server-side proxy route, Vercel Blob for shared storage, Vercel Cron for the weekly refresh.
