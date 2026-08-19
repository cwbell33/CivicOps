import { GROUPS, DEFAULT_SOURCES } from "./sources";
import { callClaude } from "./anthropic";
import { readStoredEvents, writeStoredEvents } from "./events-store";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildPrompt(sources) {
  const byGroup = GROUPS.map((g) => {
    const names = sources.filter((s) => s.group === g).map((s) => s.name);
    return names.length ? `${g}: ${names.join(", ")}` : null;
  }).filter(Boolean).join("\n");

  return `You are an event scout for CNL Seattle (Center for New Liberalism), a pro-housing, pro-transit liberal group in the Puget Sound region (King, Snohomish, and Pierce counties, centered on Seattle).

Use web search to find REAL, upcoming, in-person civic events in roughly the next 6 weeks (today is ${todayISO()}) that members could attend. Three categories: Volunteering (service, mutual aid, cleanups, food banks, Habitat builds); Political (city/county council meetings, public hearings on housing & transit, advocacy days, candidate forums, town halls, canvassing); Community Outreach (neighborhood meetings, civic forums, tabling, open houses).

PRIORITIZE searching these specific trusted sources first, then fall back to general search:
${byGroup}

Be efficient: use at most 12-15 total searches. Don't search every source individually — group related sources into broader queries where possible.

Weight HEAVILY toward HOUSING (zoning, density, tenant rights, homelessness, comprehensive plan) and TRANSIT (Sound Transit, light rail/bus expansion, Vision Zero, bike/ped).

Return ONLY valid minified JSON, no markdown or commentary, exactly:
{"events":[{"title":"","date":"YYYY-MM-DD","time":"","location":"","category":"Volunteering|Political|Community Outreach","issue":"Housing|Transit|General","why":"one short sentence on why it fits CNL Seattle","source":"which org it came from","url":""}]}
Up to 12 events. Keep string values concise (why ≤10 words). Real URLs. Empty string if time unknown. JSON only.`;
}

function repairAndParse(str) {
  try { return JSON.parse(str); } catch {}
  for (const suffix of ['"}]}', '}]}', ',"url":""}]}']) {
    try { return JSON.parse(str + suffix); } catch {}
  }
  const cut = str.lastIndexOf(',{"');
  if (cut > 0) { try { return JSON.parse(str.slice(0, cut) + ']}'); } catch {} }
  return null;
}

export async function runEventSearch(sources) {
  const activeSources = sources && sources.length ? sources : DEFAULT_SOURCES;
  const prompt = buildPrompt(activeSources);

  const data = await callClaude({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 15 }],
  });

  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in the response. Try running it again.");
  clean = clean.slice(start, end + 1);
  const parsed = repairAndParse(clean);
  if (!parsed) throw new Error("Couldn't parse the response. Try running it again.");
  const list = (parsed.events || []).filter((e) => e && e.title);
  if (!list.length) throw new Error("No events returned. Try again or adjust your sources.");

  const existing = await readStoredEvents();
  const key = (e) => `${(e.title || "").toLowerCase().trim()}|${e.date || ""}`;
  const existingKeys = new Set(existing.map(key));
  const newOnly = list.filter((e) => !existingKeys.has(key(e)));

  let merged = existing;
  if (newOnly.length) {
    merged = [...existing, ...newOnly].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    await writeStoredEvents(merged);
  }

  return { events: merged, newEventsCount: newOnly.length, usage: data.usage || null };
}
