import { runEventSearch } from "../../../lib/find-events";

export const maxDuration = 300;

export async function POST(request) {
  let sources;
  try {
    const body = await request.json();
    if (Array.isArray(body?.sources) && body.sources.length) {
      sources = body.sources.filter((s) => s && s.enabled !== false);
    }
  } catch {}

  try {
    const result = await runEventSearch(sources);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || "The event search failed. Try again." }, { status: 500 });
  }
}
