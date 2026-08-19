import { get, put } from "@vercel/blob";

export async function GET() {
  const testKey = "storage-test.json";
  const testValue = { ok: true, timestamp: new Date().toISOString() };

  try {
    await put(testKey, JSON.stringify(testValue), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });

    const result = await get(testKey, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return Response.json(
        { ok: false, stage: "read", error: "Write succeeded but read failed." },
        { status: 500 }
      );
    }

    const text = await new Response(result.stream).text();
    return Response.json({ ok: true, wrote: testValue, readBack: JSON.parse(text) });
  } catch (err) {
    return Response.json({ ok: false, stage: "write-or-read", error: err.message }, { status: 500 });
  }
}
