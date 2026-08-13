import { get, put } from "@vercel/blob";

const EVENTS_PATHNAME = "cnl-events.json";

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

export async function readStoredEvents() {
  if (!blobConfigured()) return [];
  try {
    const result = await get(EVENTS_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read stored events:", err);
    return [];
  }
}

export async function writeStoredEvents(events) {
  if (!blobConfigured()) {
    console.warn(
      "Vercel Blob isn't configured — skipping persistence. Connect a Blob store to this project to share results across visitors."
    );
    return;
  }
  await put(EVENTS_PATHNAME, JSON.stringify(events), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}
