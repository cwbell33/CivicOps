import { runEventSearch } from "../../../../lib/find-events";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runEventSearch();
    return Response.json({ ok: true, newEventsCount: result.newEventsCount });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
