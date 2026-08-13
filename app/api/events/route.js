import { readStoredEvents, writeStoredEvents } from "../../../lib/events-store";

export async function GET() {
  const events = await readStoredEvents();
  return Response.json({ events });
}

export async function DELETE() {
  await writeStoredEvents([]);
  return Response.json({ events: [] });
}
