"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, MapPin, Calendar, ExternalLink, Check, Download, Copy, Mail, Loader2, RefreshCw, AlertCircle, Filter, Plus, Trash2, Link as LinkIcon, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { GROUPS, DEFAULT_SOURCES } from "../lib/sources";

const CATEGORIES = ["Volunteering", "Political", "Community Outreach"];
const ISSUES = ["Housing", "Transit", "General"];

const CAT_STYLE = {
  "Volunteering": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Political": "bg-blue-100 text-blue-800 border-blue-200",
  "Community Outreach": "bg-purple-100 text-purple-800 border-purple-200",
};
const ISSUE_STYLE = {
  "Housing": "bg-amber-100 text-amber-800 border-amber-200",
  "Transit": "bg-sky-100 text-sky-800 border-sky-200",
  "General": "bg-slate-100 text-slate-700 border-slate-200",
};

const SEED_SOURCES = DEFAULT_SOURCES.map((s, i) => ({ ...s, id: i, enabled: true }));

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "Date TBD";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function parseTime(t) {
  if (!t) return null;
  const m = t.trim().match(/(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3] ? m[3].toLowerCase().replace(/\./g, "") : null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}
function pad(n) { return String(n).padStart(2, "0"); }
function escICS(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function buildICS(events) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CNL Seattle//Event Finder//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  events.forEach((e, i) => {
    const d = (e.date || "").replace(/-/g, "");
    if (!d) return;
    const t = parseTime(e.time);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:cnl-${i}-${d}@cnlseattle`);
    lines.push(`DTSTAMP:${stamp}`);
    if (t) {
      lines.push(`DTSTART:${d}T${pad(t.h)}${pad(t.m)}00`);
      let eh = t.h + 2; if (eh > 23) eh = 23;
      lines.push(`DTEND:${d}T${pad(eh)}${pad(t.m)}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    }
    lines.push(`SUMMARY:${escICS(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escICS(e.location)}`);
    lines.push(`DESCRIPTION:${escICS([e.why, e.time ? "Time: " + e.time : "", e.url].filter(Boolean).join("\\n"))}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function buildSummary(events) {
  let out = `CNL Seattle — Upcoming Civic Events (curated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })})\n\n`;
  CATEGORIES.forEach((cat) => {
    const inCat = events.filter((e) => e.category === cat);
    if (!inCat.length) return;
    out += `${cat.toUpperCase()}\n`;
    inCat.forEach((e) => {
      out += `• ${e.title} — ${fmtDate(e.date)}${e.time ? " · " + e.time : ""}\n`;
      if (e.location) out += `  ${e.location}\n`;
      if (e.issue && e.issue !== "General") out += `  Issue: ${e.issue}\n`;
      if (e.why) out += `  Why us: ${e.why}\n`;
      if (e.url) out += `  ${e.url}\n`;
      out += `\n`;
    });
  });
  out += `— Prepared via the CNL Seattle Event Finder. ${events.length} event${events.length === 1 ? "" : "s"} for review.`;
  return out;
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [usage, setUsage] = useState(null);
  const [newEventsCount, setNewEventsCount] = useState(null);

  const [fCat, setFCat] = useState("All");
  const [fIssue, setFIssue] = useState("All");
  const [query, setQuery] = useState("");
  const [chairEmail, setChairEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const [sources, setSources] = useState(SEED_SOURCES);
  const [showSources, setShowSources] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState(GROUPS[0]);

  // Load the shared, server-stored events on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (Array.isArray(data.events) && data.events.length) {
          setEvents(data.events);
          setSelected(new Set(data.events.map((_, i) => i)));
        }
      } catch {}
      setStorageReady(true);
    })();
  }, []);

  const enabledSources = sources.filter((s) => s.enabled);

  async function findEvents() {
    setLoading(true);
    setError("");
    setNewEventsCount(null);

    try {
      const res = await fetch("/api/find-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: enabledSources }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "The event search failed. Try again.");

      const merged = data.events || [];
      setEvents(merged);
      setSelected(new Set(merged.map((_, i) => i)));
      setNewEventsCount(data.newEventsCount ?? 0);
      setLastRun(new Date());
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function clearSaved() {
    setEvents([]); setSelected(new Set()); setNewEventsCount(null);
    try { await fetch("/api/events", { method: "DELETE" }); } catch {}
  }

  const filtered = useMemo(() => {
    return events.map((e, i) => ({ e, i }))
      .filter(({ e }) => fCat === "All" || e.category === fCat)
      .filter(({ e }) => fIssue === "All" || e.issue === fIssue)
      .filter(({ e }) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (e.title + " " + (e.location || "") + " " + (e.why || "") + " " + (e.source || "")).toLowerCase().includes(q);
      });
  }, [events, fCat, fIssue, query]);

  const selectedEvents = useMemo(() => events.filter((_, i) => selected.has(i)), [events, selected]);

  function toggle(i) { const n = new Set(selected); n.has(i) ? n.delete(i) : n.add(i); setSelected(n); }
  function selectAllVisible() { const n = new Set(selected); filtered.forEach(({ i }) => n.add(i)); setSelected(n); }
  function clearSelection() { setSelected(new Set()); }

  function toggleSource(id) { setSources(sources.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s)); }
  function removeSource(id) { setSources(sources.filter((s) => s.id !== id)); }
  function setSourceUrl(id, url) { setSources(sources.map((s) => s.id === id ? { ...s, url } : s)); }
  function addSource() {
    if (!newName.trim()) return;
    setSources([...sources, { id: Date.now(), name: newName.trim(), group: newGroup, url: "", enabled: true }]);
    setNewName("");
  }

  function downloadICS() {
    const blob = new Blob([buildICS(selectedEvents)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cnl-seattle-events-${todayISO()}.ics`; a.click();
    URL.revokeObjectURL(url);
  }
  function copySummary() {
    navigator.clipboard.writeText(buildSummary(selectedEvents));
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  function emailChair() {
    const subject = encodeURIComponent(`CNL Seattle — ${selectedEvents.length} events for review`);
    const body = encodeURIComponent(buildSummary(selectedEvents) + "\n\n(Attach the downloaded .ics file to add these to the calendar.)");
    window.open(`mailto:${chairEmail.trim()}?subject=${subject}&body=${body}`, "_blank");
  }

  const linkSources = sources.filter((s) => s.url);
  const hasEvents = events.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 font-black text-lg">CNL</div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Seattle Civic Event Finder</h1>
            <p className="text-sm text-slate-300">Housing & transit events across Puget Sound</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={findEvents} disabled={loading}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-900 font-semibold px-5 py-2.5 rounded-lg transition-colors">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasEvents ? <RefreshCw className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {loading ? "Scouting events…" : hasEvents ? "Find more events" : "Find Events"}
          </button>
          <button onClick={() => setShowSources(!showSources)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-lg border border-slate-200 transition-colors">
            <Building2 className="h-4 w-4" /> Sources ({enabledSources.length})
            {showSources ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setShowLinks(!showLinks)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-lg border border-slate-200 transition-colors">
            <LinkIcon className="h-4 w-4" /> Quick links
            {showLinks ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {hasEvents && (
            <button onClick={clearSaved}
              className="inline-flex items-center gap-2 bg-white hover:bg-red-50 text-red-500 font-medium px-4 py-2.5 rounded-lg border border-red-200 transition-colors text-sm">
              <Trash2 className="h-4 w-4" /> Clear saved
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {lastRun && <span className="text-sm text-slate-500">Last run {lastRun.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
            {usage && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                {(usage.input_tokens || 0).toLocaleString()} in · {(usage.output_tokens || 0).toLocaleString()} out · {((usage.input_tokens || 0) + (usage.output_tokens || 0)).toLocaleString()} total
              </span>
            )}
          </div>
        </div>

        {/* New events toast */}
        {newEventsCount !== null && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm ${newEventsCount > 0 ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-slate-50 border border-slate-200 text-slate-600"}`}>
            <Check className="h-4 w-4 shrink-0" />
            {newEventsCount > 0 ? `${newEventsCount} new event${newEventsCount === 1 ? "" : "s"} added to your saved list.` : "No new events found — all results were already saved."}
          </div>
        )}

        {/* Quick links */}
        {showLinks && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-500 mb-3">Verified calendar & event pages — open directly to spot-check anything the search misses.</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {GROUPS.map((g) => {
                const items = linkSources.filter((s) => s.group === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{g}</div>
                    <ul className="space-y-1">
                      {items.map((s) => (
                        <li key={s.id}>
                          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                            {s.name} <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sources manager */}
        {showSources && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-500 mb-3">Every search prioritizes these orgs. Toggle on/off, paste a calendar URL to add it to Quick Links, or add your own.</p>
            <div className="space-y-4">
              {GROUPS.map((g) => {
                const items = sources.filter((s) => s.group === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{g}</div>
                    <div className="space-y-1.5">
                      {items.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <button onClick={() => toggleSource(s.id)}
                            className={`h-5 w-5 rounded shrink-0 flex items-center justify-center border ${s.enabled ? "bg-amber-400 border-amber-400" : "border-slate-300"}`}>
                            {s.enabled && <Check className="h-3.5 w-3.5 text-slate-900" />}
                          </button>
                          <span className={`text-sm flex-1 ${s.enabled ? "text-slate-800" : "text-slate-400 line-through"}`}>{s.name}</span>
                          <input value={s.url} onChange={(e) => setSourceUrl(s.id, e.target.value)} placeholder="paste calendar URL"
                            className="hidden md:block w-48 text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300" />
                          <button onClick={() => removeSource(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add an org or council…"
                className="flex-1 min-w-40 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
                className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select>
              <button onClick={addSource} className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-6 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {loading && !hasEvents && (
          <div className="text-center py-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-400" />
            <p>Searching your trusted sources and beyond…</p>
          </div>
        )}

        {!hasEvents && !loading && !error && storageReady && (
          <div className="text-center py-16 text-slate-500">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">No events yet</p>
            <p className="text-sm mt-1">Hit <span className="font-semibold">Find Events</span> to scout opportunities from your {enabledSources.length} trusted sources.</p>
          </div>
        )}

        {hasEvents && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4" /> Filters</div>
                <div className="relative mb-3">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, location, org, or topic…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["All", ...CATEGORIES].map((c) => (
                    <button key={c} onClick={() => setFCat(c)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${fCat === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>{c}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["All", ...ISSUES].map((c) => (
                    <button key={c} onClick={() => setFIssue(c)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${fIssue === c ? "bg-amber-400 text-slate-900 border-amber-400" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{filtered.length} shown · {selected.size} selected · {events.length} saved</span>
                <div className="flex gap-3">
                  <button onClick={selectAllVisible} className="text-slate-600 hover:text-slate-900 font-medium">Select visible</button>
                  <button onClick={clearSelection} className="text-slate-600 hover:text-slate-900 font-medium">Clear</button>
                </div>
              </div>

              <div className="space-y-3">
                {filtered.map(({ e, i }) => {
                  const isSel = selected.has(i);
                  return (
                    <div key={i} onClick={() => toggle(i)}
                      className={`cursor-pointer bg-white border rounded-xl p-4 transition-all ${isSel ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-5 w-5 rounded shrink-0 flex items-center justify-center border ${isSel ? "bg-amber-400 border-amber-400" : "border-slate-300"}`}>
                          {isSel && <Check className="h-3.5 w-3.5 text-slate-900" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${CAT_STYLE[e.category] || CAT_STYLE["Community Outreach"]}`}>{e.category}</span>
                            {e.issue && <span className={`text-xs px-2 py-0.5 rounded-full border ${ISSUE_STYLE[e.issue] || ISSUE_STYLE["General"]}`}>{e.issue}</span>}
                          </div>
                          <h3 className="font-semibold text-slate-900 leading-snug">{e.title}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}</span>
                            {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
                          </div>
                          {e.why && <p className="text-sm text-slate-600 mt-2 italic">{e.why}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            {e.url && (
                              <a href={e.url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">Source <ExternalLink className="h-3 w-3" /></a>
                            )}
                            {e.source && <span className="text-xs text-slate-400">via {e.source}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No events match these filters.</div>}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-4">
                <h2 className="font-bold text-slate-900 mb-1">Hand off to the chair</h2>
                <p className="text-sm text-slate-500 mb-4">{selected.size} event{selected.size === 1 ? "" : "s"} ready to package.</p>
                <button onClick={downloadICS} disabled={!selected.size}
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-lg mb-2 transition-colors">
                  <Download className="h-4 w-4" /> Download calendar (.ics)
                </button>
                <button onClick={copySummary} disabled={!selected.size}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-medium px-4 py-2.5 rounded-lg border border-slate-200 mb-4 transition-colors">
                  {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy summary</>}
                </button>
                <div className="border-t border-slate-100 pt-4">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Chair email</label>
                  <input value={chairEmail} onChange={(e) => setChairEmail(e.target.value)} placeholder="chair@cnlseattle.org"
                    className="w-full mt-1 mb-2 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <button onClick={emailChair} disabled={!selected.size}
                    className="w-full inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-semibold px-4 py-2.5 rounded-lg transition-colors">
                    <Mail className="h-4 w-4" /> Email for review
                  </button>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">Opens your mail app with the summary pre-filled. Attach the downloaded .ics so the chair can add events to the calendar.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
