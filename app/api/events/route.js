import { readStoredEvents } from "../../../lib/events-store";

// Read-only on purpose: the event list is written only by the local refresh
// scripts, which hold the storage token. Nothing here can change it.
export async function GET() {
  const events = await readStoredEvents();
  return Response.json({ events });
}
