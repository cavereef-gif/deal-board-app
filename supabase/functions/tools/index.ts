// Record copy of the Supabase edge function `tools` (28 Sep 2026: + weekly market prices from the public SMM reviews; tasks for "Both" count in the 07:00 note; 3 Oct 2026: prototype phones get a content-free 07:00 note and the app-icon number – see protoNote). Deployed from the Claude project, never from this repo.
// Deal Board free services (Chris, 26 Sep 2026: "i want all the free api"): everything here costs R0 except a few cents of
// Claude when the monthly diesel statement is read. Nothing here changes a deal or a task: prices arrive as "suggested" and a
// person accepts them with one tap; routes and places are remembered so the same question never costs twice.
//   route      – two place names → truck distance and time (Geoapify truck routing; TomTom as a check; OSRM car route when
//                there is no key yet), the toll plazas on the way (SANRAL 1 March 2026 table) and the map line
//   places     – place-name suggestions: first the places already pinned, then Geoapify (or OpenStreetMap) search
//   diesel     – the latest official diesel price (DMPR monthly documents, read by Claude) as a suggestion
//   borders    – the weekly cross-border report (WCO ESA / FESARTA), read by Claude into a short note
//   holidays   – South African public holidays (Nager.Date)
//   weather    – rain and wind for the next three days at the ports and route ends (MET Norway)
//   push_*     – phone reminders (web push, free): push_key (the public key; the key pair is made here once and kept in
//                Vault), push_test (a test note to your own phones), push_daily (07:00 weekdays: late / due today / suggested)
//   market     – chrome and manganese ore prices (weekly, Mondays): the newest free SMM reviews, the price sentences read by
//                Claude, every figure checked against the sentence it came from; they arrive as "suggested"
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";
import webpush from "npm:web-push@3.6.7";

const UA = "DealBoard/1.0 (github.com/cavereef-gif/deal-board-app)";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const norm = (s: string) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const COUNTRIES = "za,mz,bw,zw,na,sz,ls";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url: string, init: RequestInit = {}, ms = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, "Accept": "application/json", ...(init.headers || {}) } });
    const text = await r.text();
    let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
    return { ok: r.ok, status: r.status, body };
  } finally { clearTimeout(t); }
}

// ---------------- places ----------------
type Pt = { name: string; lat: number; lon: number; label?: string; source: string };
async function geocodeOne(admin: any, keys: Record<string, string>, name: string): Promise<Pt> {
  const k = norm(name);
  const { data: saved } = await admin.from("places").select("name,lat,lon,address").eq("key", k).not("lat", "is", null).maybeSingle();
  if (saved) {
    await admin.from("places").update({ used_at: new Date().toISOString() }).eq("key", k);
    return { name, lat: saved.lat, lon: saved.lon, label: saved.address || saved.name, source: "saved" };
  }
  let pt: Pt | null = null, lastErr = "";
  if (keys.geoapify) {
    const u = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(name)}&filter=countrycode:${COUNTRIES}&bias=countrycode:za&limit=1&format=json&apiKey=${keys.geoapify}`;
    const r = await getJSON(u);
    const x = r.ok && r.body && r.body.results && r.body.results[0];
    if (x) pt = { name, lat: x.lat, lon: x.lon, label: x.formatted, source: "geoapify" };
  }
  if (!pt) {
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${COUNTRIES}&q=${encodeURIComponent(name)}`;
    const r = await getJSON(u, { headers: { "Accept-Language": "en" } });
    const x = r.ok && Array.isArray(r.body) && r.body[0];
    if (x) pt = { name, lat: +x.lat, lon: +x.lon, label: x.display_name, source: "openstreetmap" };
    else if (!r.ok) lastErr = `place search answered ${r.status}`;
  }
  if (!pt) {   // Photon (OpenStreetMap data, komoot) – southern Africa box
    const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&lang=en&limit=1&bbox=11,-35,41,-15`;
    const r = await getJSON(u);
    const f = r.ok && r.body && r.body.features && r.body.features[0];
    if (f) { const pr = f.properties || {}; pt = { name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: [pr.name, pr.city, pr.state, pr.country].filter(Boolean).join(", "), source: "photon" }; }
    else if (!r.ok) lastErr += ` / photon ${r.status}`;
  }
  if (!pt) throw new Error(`need_key: couldn't find "${name}"${lastErr ? " (" + lastErr.trim() + ")" : ""}`);
  await admin.from("places").upsert({ name: name.trim(), lat: pt.lat, lon: pt.lon, address: pt.label, source: pt.source }, { onConflict: "key", ignoreDuplicates: false });
  return pt;
}

async function suggestPlaces(admin: any, keys: Record<string, string>, q: string) {
  const out: any[] = [];
  const { data: saved } = await admin.from("places").select("name,address,kind").ilike("name", `%${q.replace(/[%_]/g, "")}%`).order("used_at", { ascending: false }).limit(6);
  for (const p of saved || []) out.push({ name: p.name, label: p.address || "", kind: p.kind, saved: true });
  if (keys.geoapify && q.length >= 3 && out.length < 6) {
    const u = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&filter=countrycode:${COUNTRIES}&bias=countrycode:za&limit=5&format=json&apiKey=${keys.geoapify}`;
    const r = await getJSON(u);
    for (const x of (r.ok && r.body && r.body.results) || []) {
      const nm = x.name || x.city || x.town || x.village || x.suburb || x.formatted;
      if (nm && !out.some((o) => norm(o.name) === norm(nm))) out.push({ name: nm, label: x.formatted, kind: x.result_type, saved: false });
    }
  }
  return out.slice(0, 8);
}

// ---------------- routes ----------------
function flatten(geom: any): [number, number][] {
  if (!geom) return [];
  if (geom.type === "LineString") return geom.coordinates;
  if (geom.type === "MultiLineString") return geom.coordinates.flat();
  return [];
}
// keep the stored line light (at most 3,000 points) but close enough to the road for the toll check
function thin(pts: [number, number][], maxN = 3000): [number, number][] {
  if (pts.length <= maxN) return pts;
  const step = Math.ceil(pts.length / maxN), out: [number, number][] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}
// distance in metres from point P to segment AB (small-area flat projection – fine at plaza scale)
function segDist(p: [number, number], a: [number, number], b: [number, number]) {
  const k = Math.cos((p[1] * Math.PI) / 180), R = 6371000 * Math.PI / 180;
  const ax = (a[0] - p[0]) * k * R, ay = (a[1] - p[1]) * R, bx = (b[0] - p[0]) * k * R, by = (b[1] - p[1]) * R;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? -(ax * dx + ay * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.sqrt(x * x + y * y), dLon: b[0] - a[0], dLat: b[1] - a[1] };
}
// which plazas the route passes. Mainline plazas within 150 m of the line are ticked; ramp plazas within 60 m are offered
// unticked (a truck passing the mainline also passes close to the ramps beside it). One-direction plazas count only when
// the truck travels that way.
function plazasOnRoute(line: [number, number][], plazas: any[]) {
  const hits: any[] = [];
  const minLat = Math.min(...line.map((p) => p[1])) - 0.02, maxLat = Math.max(...line.map((p) => p[1])) + 0.02;
  const minLon = Math.min(...line.map((p) => p[0])) - 0.02, maxLon = Math.max(...line.map((p) => p[0])) + 0.02;
  for (const z of plazas) {
    if (z.lat < minLat || z.lat > maxLat || z.lon < minLon || z.lon > maxLon) continue;
    const p: [number, number] = [z.lon, z.lat];
    let best = { d: Infinity, dLon: 0, dLat: 0, i: 0 };
    for (let i = 1; i < line.length; i++) {
      const s = segDist(p, line[i - 1], line[i]);
      if (s.d < best.d) best = { ...s, i };
    }
    const ramp = /ramp/i.test(z.name);
    if (best.d > (ramp ? 60 : 150)) continue;
    const dir = z.direction || "both";
    const way = dir === "northbound" ? best.dLat > 0 : dir === "southbound" ? best.dLat < 0 : dir === "eastbound" ? best.dLon > 0 : dir === "westbound" ? best.dLon < 0 : true;
    if (!way) continue;
    hits.push({ id: z.id, name: z.name, road: z.road, operator: z.operator, direction: dir, lat: z.lat, lon: z.lon,
      c1: +z.class1, c2: +z.class2, c3: +z.class3, c4: +z.class4, dist_m: Math.round(best.d), ramp, pick: !ramp, at: best.i });
  }
  // a ramp right next to a ticked mainline plaza of the same name is almost never paid as well
  const main = hits.filter((h) => !h.ramp).map((h) => h.id);
  for (const h of hits) if (h.ramp && main.some((m) => h.id.startsWith(m))) h.pick = false;
  return hits.sort((a, b) => a.at - b.at).map(({ at, ...h }) => h);
}

async function route(admin: any, keys: Record<string, string>, body: any) {
  const from = String(body.from || "").trim(), to = String(body.to || "").trim();
  if (!from || !to) throw new Error("type where from and where to");
  const mode = keys.geoapify ? "heavy_truck" : "car";
  const fk = norm(from), tk = norm(to);
  if (!body.fresh) {
    const { data: cached } = await admin.from("routes").select("*").eq("from_key", fk).eq("to_key", tk).eq("mode", mode).maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 180 * 86400e3) {
      await admin.from("routes").update({ uses: (cached.uses || 1) + 1 }).eq("id", cached.id);
      const { data: plazas } = await admin.from("toll_plazas").select("*");
      return { ...shape(cached), plazas: plazasOnRoute(cached.geometry.coordinates, plazas || []), cached: true };
    }
  }
  const a = await geocodeOne(admin, keys, from);
  if (a.source === "openstreetmap") await sleep(1100);   // Nominatim asks for at most one search a second
  const b = await geocodeOne(admin, keys, to);
  let km = 0, minutes = 0, provider = "", line: [number, number][] = [];
  if (keys.geoapify) {
    let r = await getJSON(`https://api.geoapify.com/v1/routing?waypoints=${a.lat},${a.lon}|${b.lat},${b.lon}&mode=heavy_truck&apiKey=${keys.geoapify}`);
    if (!r.ok) r = await getJSON(`https://api.geoapify.com/v1/routing?waypoints=${a.lat},${a.lon}|${b.lat},${b.lon}&mode=truck&apiKey=${keys.geoapify}`);
    const f = r.ok && r.body && r.body.features && r.body.features[0];
    if (f) { km = f.properties.distance / 1000; minutes = f.properties.time / 60; line = flatten(f.geometry); provider = "Geoapify truck route"; }
  }
  if (!line.length) {
    const r = await getJSON(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`);
    const x = r.ok && r.body && r.body.routes && r.body.routes[0];
    if (!x) throw new Error("no road route found between those places");
    km = x.distance / 1000; minutes = x.duration / 60; line = x.geometry.coordinates; provider = "OpenStreetMap car route (add the Geoapify key for truck routes)";
  }
  let check_km: number | null = null, check_provider: string | null = null;
  if (keys.tomtom) {
    const r = await getJSON(`https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json?travelMode=truck&vehicleCommercial=true&vehicleWeight=56000&routeType=fastest&key=${keys.tomtom}`);
    const s = r.ok && r.body && r.body.routes && r.body.routes[0] && r.body.routes[0].summary;
    if (s) { check_km = s.lengthInMeters / 1000; check_provider = "TomTom truck route"; }
  }
  const geometry = { type: "LineString", coordinates: thin(line).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]) };
  const { data: plazas } = await admin.from("toll_plazas").select("*");
  const hits = plazasOnRoute(line, plazas || []);
  const row = { from_name: from, to_name: to, from_lat: a.lat, from_lon: a.lon, to_lat: b.lat, to_lon: b.lon, km: Math.round(km * 10) / 10,
    minutes: Math.round(minutes), provider, mode, check_km: check_km == null ? null : Math.round(check_km * 10) / 10, check_provider, geometry,
    plaza_ids: hits.map((h) => h.id), fetched_at: new Date().toISOString() };
  await admin.from("routes").upsert(row, { onConflict: "from_key,to_key,mode" });
  return { ...shape(row), from_label: a.label, to_label: b.label, plazas: hits, cached: false };
}
const shape = (r: any) => ({ from: r.from_name, to: r.to_name, a: { lat: r.from_lat, lon: r.from_lon }, b: { lat: r.to_lat, lon: r.to_lon },
  km: +r.km, minutes: +r.minutes, provider: r.provider, mode: r.mode, check_km: r.check_km == null ? null : +r.check_km, check_provider: r.check_provider, line: r.geometry });

// ---------------- diesel ----------------
// DMPR publishes each month's prices as a ZIP of PDFs linked from its Fuel Prices page. We open the newest ZIP, take the
// price breakdown/schedule PDF and ask Claude for the 50ppm diesel wholesale price (inland = Gauteng, coastal = the ports).
const DMPR = "https://www.dmpr.gov.za/Branches/Petroleum-Resources/Fuel-Prices";
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
async function diesel(admin: any, claudeKey: string, force = false) {
  const { data: recent } = await admin.from("fuel_prices").select("*").order("effective", { ascending: false }).order("created_at", { ascending: false }).limit(6);
  const latest = (recent || [])[0];
  const checkedRecently = (recent || []).some((r: any) => r.source && r.source.startsWith("DMPR") && Date.now() - new Date(r.created_at).getTime() < 3 * 86400e3);
  if (checkedRecently && !force) return { prices: recent, checked: false };
  const page = await fetch(DMPR, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const m = page.match(/Fuel Prices Effective from (\d{1,2}) ([A-Za-z]+) (20\d\d)<\/h3>[\s\S]*?href="([^"]+)"/);
  if (!m) return { prices: recent, checked: true, note: "The official page has changed – type the price for now." };
  const effective = `${m[3]}-${String(MONTHS[m[2].toLowerCase()] || 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if ((recent || []).some((r: any) => r.effective === effective && r.source && r.source.startsWith("DMPR"))) return { prices: recent, checked: true };
  if (!claudeKey) return { prices: recent, checked: true, note: "The bot key is needed to read the diesel statement." };
  const href = m[4].replace(/&amp;/g, "&"), url = href.startsWith("http") ? href : "https://www.dmpr.gov.za" + href;
  const file = new Uint8Array(await (await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" })).arrayBuffer());
  // the pack is a ZIP (sometimes a ZIP inside a ZIP): collect the PDFs, and Word documents as a fallback
  const pdfs: { name: string; data: Uint8Array }[] = [], docs: { name: string; data: Uint8Array }[] = [], names: string[] = [];
  const collect = (buf: Uint8Array, depth: number) => {
    if (depth > 3) return;
    if (buf[0] === 0x25 && buf[1] === 0x50) { pdfs.push({ name: "prices.pdf", data: buf }); return; }
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return;
    let files: Record<string, Uint8Array>; try { files = unzipSync(buf); } catch { return; }
    for (const [n, d] of Object.entries(files)) {
      if (!d.length) continue;
      names.push(n);
      if (/\.pdf$/i.test(n)) pdfs.push({ name: n, data: d });
      else if (/\.docx$/i.test(n)) docs.push({ name: n, data: d });
      else if (/\.zip$/i.test(n)) collect(d, depth + 1);
    }
  };
  collect(file, 0);
  // best first: the price breakdown, then the schedule, then anything with "price", then the media statement
  const rank = (n: string) => (/breakdown/i.test(n) ? 0 : /schedule/i.test(n) ? 1 : /price/i.test(n) ? 2 : /statement|media/i.test(n) ? 4 : 3);
  pdfs.sort((x, y) => rank(x.name) - rank(y.name)); docs.sort((x, y) => rank(x.name) - rank(y.name));
  // Word documents are read as text (a .docx is a zip holding word/document.xml); Claude reads the PDF itself
  const docText: string[] = [];
  for (const d of docs.slice(0, 2)) {
    try {
      const inner = unzipSync(d.data);
      const xml = new TextDecoder().decode(inner["word/document.xml"] || new Uint8Array());
      const txt = xml.replace(/<\/w:p>/g, "\n").replace(/<\/w:tc>/g, " | ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").trim();
      if (/diesel/i.test(txt)) docText.push(`=== ${d.name} ===\n` + txt.slice(0, 40000));
    } catch { /* not a Word file after all */ }
  }
  const pdf = pdfs[0];
  if (!docText.length && !pdf) return { prices: recent, checked: true, note: "No readable price document this month (" + names.slice(0, 8).join(", ") + ") – type the price for now." };
  let b64 = ""; const CH = 0x8000;
  if (pdf && pdf.data.length <= 20e6) { for (let i = 0; i < pdf.data.length; i += CH) b64 += String.fromCharCode(...pdf.data.subarray(i, i + CH)); b64 = btoa(b64); }
  const content: any[] = [];
  if (docText.length) content.push({ type: "text", text: docText.join("\n\n") });
  if (b64) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
  content.push({ type: "text", text: "From these South African fuel price documents, give the 50ppm (0.005% sulphur) diesel WHOLESALE price in rand per litre for inland (Gauteng) and coastal (the coast, e.g. Durban). Use the breakdown or schedule of prices, not just the monthly change. Prices may be printed in cents per litre – convert to rand (divide by 100). Give a region only if that exact region is printed for 0.005% diesel; otherwise null. Never work a number out from other numbers." });
  const tool = { name: "prices", description: "Report the 50ppm (0.005% sulphur) diesel WHOLESALE price in rand per litre.", input_schema: { type: "object", properties: {
    inland: { type: ["number", "null"], description: "Gauteng / inland wholesale 50ppm diesel, rand per litre, e.g. 30.05" },
    coastal: { type: ["number", "null"], description: "Coastal (e.g. Durban) wholesale 50ppm diesel, rand per litre" },
    effective: { type: ["string", "null"], description: "Effective date YYYY-MM-DD if shown" },
    found_in: { type: "string", description: "Which table or page the numbers came from, in a few words" } }, required: ["inland", "coastal", "found_in"] } };
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, tools: [tool], tool_choice: { type: "tool", name: "prices" }, messages: [{ role: "user", content }] }) });
  const out = await res.json();
  const use = (out.content || []).find((c: any) => c.type === "tool_use");
  const v = use && use.input;
  const fix = (n: any) => (typeof n === "number" && n > 500 && n < 8000 ? n / 100 : n);   // cents per litre → rand
  if (v) { v.inland = fix(v.inland); v.coastal = fix(v.coastal); }
  // only keep a number that is really printed in the Word text (as c/l, e.g. "2955.510", or as rand) – never a guess
  const plain = docText.join(" ").replace(/\s/g, "");
  const printed = (n: any) => {
    if (typeof n !== "number") return false;
    if (!docText.length) return true;                    // a PDF only: Claude read it directly, a person checks
    const c = (n * 100).toFixed(2), r = n.toFixed(2);
    return plain.includes(c) || plain.includes(c.replace(".", ",")) || plain.includes("R" + r) || plain.includes(r.replace(".", ","));
  };
  if (v) { if (!printed(v.inland)) v.inland = null; if (!printed(v.coastal)) v.coastal = null; }
  const ok = (n: any) => typeof n === "number" && n > 5 && n < 80;
  if (!v || (!ok(v.inland) && !ok(v.coastal))) return { prices: recent, checked: true, note: "Couldn't read the diesel price from this month's document – type it for now.",
    detail: { read: [...docs.slice(0, 2).map((d) => d.name), ...(pdf ? [pdf.name] : [])], files: names.slice(0, 8), answer: v || out.error || out.stop_reason || null } };
  const row = { effective, coastal: ok(v.coastal) ? v.coastal : null, inland: ok(v.inland) ? v.inland : null, source: "DMPR monthly price documents (read by Claude)",
    source_url: url, note: `${v.found_in || ""}`.slice(0, 300), status: "suggested" };
  await admin.from("fuel_prices").upsert(row, { onConflict: "effective,grade,source", ignoreDuplicates: true });
  const { data: after } = await admin.from("fuel_prices").select("*").order("effective", { ascending: false }).order("created_at", { ascending: false }).limit(6);
  return { prices: after, checked: true, latest_before: latest || null };
}

// ---------------- borders (weekly) ----------------
// The WCO ESA / FESARTA weekly cross-border report (a PDF) gives queue and crossing times per border. Claude reads the newest
// one into a short note for the notice board. It is published a few weeks late, so the note says which week it covers.
const WCO = "https://www.wcoesarpsg.org/?s=weekly+cross+border+report";
async function borders(admin: any, claudeKey: string, force = false) {
  const { data: last } = await admin.from("weekly_notes").select("*").eq("kind", "borders").order("week_ending", { ascending: false }).limit(1).maybeSingle();
  if (last && !force && Date.now() - new Date(last.created_at).getTime() < 3 * 86400e3) return { note: last, checked: false };
  const html = await fetch(WCO, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const links = [...new Set([...html.matchAll(/https:\/\/www\.wcoesarpsg\.org\/weekly-cross-border-report-(\d{1,2})-([a-z]+)-(20\d\d)\//g)].map((m) => m[0]))];
  const dated = links.map((u) => { const m = u.match(/report-(\d{1,2})-([a-z]+)-(20\d\d)/)!; return { u, d: `${m[3]}-${String(MONTHS[m[2]] || 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` }; }).sort((a, b) => (a.d < b.d ? 1 : -1));
  const newest = dated[0];
  if (!newest) return { note: last || null, checked: true, error: "no report found" };
  if (last && last.week_ending >= newest.d && !force) return { note: last, checked: true };
  if (!claudeKey) return { note: last || null, checked: true, error: "the bot key is needed" };
  const page = await fetch(newest.u, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const pdfUrl = (page.match(/https:\/\/www\.wcoesarpsg\.org\/wp-content\/uploads\/[^"'<> ]+\.pdf/) || [])[0];
  if (!pdfUrl) return { note: last || null, checked: true, error: "no PDF on the report page" };
  const buf = new Uint8Array(await (await fetch(pdfUrl, { headers: { "User-Agent": UA } })).arrayBuffer());
  if (buf.length > 25e6) return { note: last || null, checked: true, error: "report too big" };
  let b64 = ""; for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000)); b64 = btoa(b64);
  const tool = { name: "borders", description: "Summarise the border waiting times that matter to South African road freight.", input_schema: { type: "object", properties: {
    borders: { type: "array", maxItems: 10, items: { type: "object", properties: {
      name: { type: "string", description: "Border post, e.g. Beitbridge, Lebombo / Ressano Garcia, Kazungula, Groblersbrug, Kopfontein, Skilpadshek, Oshoek, Chirundu" },
      direction: { type: "string", description: "e.g. into Zimbabwe, into South Africa" },
      queue_hours: { type: ["number", "null"] }, crossing_hours: { type: ["number", "null"] },
      note: { type: "string", description: "A few words, e.g. 'slower than last week'" } }, required: ["name", "direction", "queue_hours", "crossing_hours", "note"] } } },
    required: ["borders"] } };
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1200, tools: [tool], tool_choice: { type: "tool", name: "borders" },
      messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: "This is the weekly cross-border report for East and Southern Africa. Give the queue and crossing times for the borders that South African trucks use (South Africa with Zimbabwe, Mozambique, Botswana, Eswatini, Namibia, and Zambia via Kazungula or Chirundu). Only numbers that are in the report; null if not shown." }] }] }) });
  const out = await res.json();
  const v = ((out.content || []).find((c: any) => c.type === "tool_use") || {}).input;
  if (!v || !Array.isArray(v.borders) || !v.borders.length) return { note: last || null, checked: true, error: "couldn't read the report" };
  // the sentence is built from the figures themselves (the AI's own wording once got a direction wrong)
  const rows = v.borders.filter((b: any) => typeof b.queue_hours === "number");
  const fmt = (b: any) => `${b.name} (${String(b.direction || "").replace(/^South Africa to /i, "into ").replace(/ to South Africa$/i, " into SA")}) ${Math.round(b.queue_hours)} h`;
  const slow = rows.filter((b: any) => b.queue_hours >= 12).sort((a: any, b: any) => b.queue_hours - a.queue_hours).slice(0, 3);
  const ok = rows.filter((b: any) => b.queue_hours < 6).sort((a: any, b: any) => a.queue_hours - b.queue_hours).slice(0, 3);
  const summary = (slow.length ? `Slow: ${slow.map(fmt).join(", ")} in the queue.` : "No border had a queue over 12 hours.") + (ok.length ? ` Quicker: ${ok.map(fmt).join(", ")}.` : "");
  const row = { kind: "borders", week_ending: newest.d, summary, data: { borders: v.borders || [] }, source_url: newest.u };
  await admin.from("weekly_notes").upsert(row, { onConflict: "kind,week_ending" });
  const { data: saved } = await admin.from("weekly_notes").select("*").eq("kind", "borders").eq("week_ending", newest.d).maybeSingle();
  return { note: saved, checked: true };
}

// ---------------- market prices (weekly) ----------------
// SMM (Shanghai Metals Market, news.metal.com) publishes free reviews that print the week's South African chrome and
// manganese ore prices – CIF China offers in US$ a ton and China port spot prices in yuan a dry ton unit. Its robots.txt
// allows reading them. We take the newest reviews, keep only the sentences with a price in them, and ask Claude for the
// figures. A figure is kept only if it is printed in the sentence it came from, and the sentence is in the article. The
// prices arrive as "suggested" (Chris, 28 Sep 2026: the free route, one tap to confirm; the paid SMM feed is not approved).
const SMM = "https://news.metal.com";
const MKT_GRADES = ["40–42% concentrate", "42–44% concentrate", "44–46% concentrate", "38–40% ROM", "40–42% lumpy", "36–37% semi-carbonate", "37% semi-carbonate lumpy", "medium-iron", "high-iron", "44% high grade", "32–34% low grade"];
const MKT_BASIS = ["CIF China", "China port spot"];
const MKT_SA = /(south africa|s\.\s?africa|\bsa\b|samancor|south32|assmang|ug2)/i;
const htmlText = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
async function fxZar(cur: string) {
  try { const r = await getJSON(`https://api.frankfurter.app/latest?from=${cur}&to=ZAR`, {}, 8000); const v = r.ok && r.body && r.body.rates && r.body.rates.ZAR; return typeof v === "number" ? v : null; } catch { return null; }
}
async function market(admin: any, claudeKey: string, force = false) {
  const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  const latest = async () => (await admin.from("market_prices").select("*").neq("status", "dropped").order("effective", { ascending: false }).limit(20)).data || [];
  const { data: last } = await admin.from("weekly_notes").select("*").eq("kind", "market").order("week_ending", { ascending: false }).limit(1).maybeSingle();
  if (last && !force && Date.now() - new Date(last.created_at).getTime() < 3 * 86400e3) return { checked: false, added: 0, prices: await latest() };
  if (!claudeKey) return { checked: true, added: 0, note: "The bot key is needed to read the price reports." };
  // 1. the newest reviews: this month's and last month's article lists (sitemaps), the minor-metals page as a fallback
  const ym = (d: Date) => d.toISOString().slice(0, 7).replace("-", "");
  const now = new Date(), prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)), since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const cand: { url: string; at: string; kind: string; score: number }[] = [];
  const rate = (slug: string) => (/review|analysis/.test(slug) ? 2 : 0) + (/price/.test(slug) ? 1 : 0) + (/weekly|daily/.test(slug) ? 1 : 0);
  const kindOf = (slug: string) => /manganese-ore|mn-ore|manganese-ore-weekly/.test(slug) || (/manganese/.test(slug) && !/silico|electrolytic|sulfate|sulphate|emm|battery/.test(slug)) ? "Manganese" : /chrom/.test(slug) ? "Chrome" : "";
  for (const m of [ym(now), ym(prev)]) {
    const r = await fetch(`${SMM}/sitemap/sitemap-newscontent-${m}.xml`, { headers: { "User-Agent": UA } }).catch(() => null);
    if (!r || !r.ok) continue;
    const xml = await r.text();
    for (const blk of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {   // each entry: the address, links to the translations, then the date
      const loc = (blk[1].match(/<loc>\s*(https:\/\/news\.metal\.com\/newscontent\/[^<\s]+)\s*<\/loc>/) || [])[1]; if (!loc) continue;
      const at = ((blk[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/) || [])[1] || "").slice(0, 10);
      let slug = loc.toLowerCase(); try { slug = decodeURIComponent(loc).toLowerCase(); } catch { /* keep the raw address */ }
      const kind = kindOf(slug);
      if (kind && at && at >= since) cand.push({ url: loc, at, kind, score: rate(slug) });
    }
  }
  if (!cand.length) {
    const r = await fetch(`${SMM}/minor-metals/other-minor-metals`, { headers: { "User-Agent": UA } }).catch(() => null);
    const html = r && r.ok ? await r.text() : "";
    for (const x of html.matchAll(/href="((?:https:\/\/news\.metal\.com)?\/newscontent\/[^"]+)"/g)) {
      const u = x[1].startsWith("http") ? x[1] : SMM + x[1]; let slug = u.toLowerCase(); try { slug = decodeURIComponent(u).toLowerCase(); } catch { /* keep */ }
      const kind = kindOf(slug);
      if (kind && !cand.some((c) => c.url === u)) cand.push({ url: u, at: "", kind, score: rate(slug) });
    }
  }
  // newest first (reviews before news items on the same day); up to 8 read per ore, stopping once two carry a price
  const pick = (k: string) => cand.filter((c) => c.kind === k).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.score - a.score)).slice(0, 8);
  const chosen = [...pick("Chrome"), ...pick("Manganese")];
  if (!chosen.length) { await admin.from("weekly_notes").upsert({ kind: "market", week_ending: today, summary: "No SMM chrome or manganese review found this week.", data: { urls: [] }, source_url: SMM }, { onConflict: "kind,week_ending" }); return { checked: true, added: 0, note: "No new chrome or manganese review this week.", prices: await latest() }; }
  // 2. keep only the sentences with a price
  const docs: { url: string; at: string; text: string; lines: string[] }[] = [], got: Record<string, number> = {};
  for (const c of chosen) {
    if ((got[c.kind] || 0) >= 2) continue;
    const r = await fetch(c.url, { headers: { "User-Agent": UA } }).catch(() => null); if (!r || !r.ok) continue;
    const html = await r.text(), text = htmlText(html);
    const at = c.at || ((html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/) || [])[1]) || today;
    // a price is a number next to a currency, or a number "per ton / per dry ton unit" – tonnage figures alone do not count
    const PRICE = /(\$\s?\d|\d[\d.,]*\s?(usd|us\$|yuan|rmb|cny)\b|\b(usd|us\$|yuan|rmb|cny)\s?\d|\d\s*\/\s*(mt|t|dmtu|mtu)\b)/i;
    // one line per price: sentences split at ";" – a port heading ("Tianjin Port") or label ("North China ports:") stays
    // with each part, so the port is never lost
    const lines: string[] = []; let carry = "";
    for (const s0 of text.split(/(?<=[.!?])\s+|\n/)) {
      const s = s0.trim(); if (!s) continue;
      if (/^[A-Z][A-Za-z .-]{2,40}\bports?:?$/i.test(s)) { carry = s.replace(/:$/, ""); continue; }
      const lab = (s.match(/^([A-Z][A-Za-z .-]{2,40}?\bports?)\s*:\s*/i) || [])[1] || carry; carry = "";   // a heading covers the next sentence only
      for (const part of s.split(/(?<=;)\s+/)) {
        const p = part.trim(), l = (lab && !p.toLowerCase().startsWith(lab.toLowerCase()) ? lab + ": " : "") + p;
        if (l.length > 20 && l.length < 600 && PRICE.test(l) && MKT_SA.test(l)) lines.push(l);
      }
    }
    if (lines.length) { docs.push({ url: c.url, at, text, lines: lines.slice(0, 12) }); got[c.kind] = (got[c.kind] || 0) + 1; }
  }
  if (!docs.length) { await admin.from("weekly_notes").upsert({ kind: "market", week_ending: today, summary: "The newest SMM reviews print no South African ore price this week.", data: { urls: chosen.map((c) => c.url) }, source_url: SMM }, { onConflict: "kind,week_ending" }); return { checked: true, added: 0, note: "The newest reviews print no South African ore price this week.", prices: await latest() }; }
  // 3. Claude reads the figures out of the sentences
  const content = docs.map((d, i) => `=== Review ${i + 1} (${d.at}) ===\n` + d.lines.join("\n").slice(0, 2500)).join("\n\n");   // each review gets its share
  const tool = { name: "prices", description: "Report South African chrome ore and manganese ore prices printed in the sentences.", input_schema: { type: "object", properties: {
    prices: { type: "array", maxItems: 12, items: { type: "object", properties: {
      review: { type: "integer", description: "The review number the sentence is in" },
      commodity: { type: "string", enum: ["Chrome", "Manganese"] },
      grade: { type: "string", enum: MKT_GRADES },
      basis: { type: "string", enum: MKT_BASIS, description: "CIF China for offers/quotes to China (usually US$ a ton); China port spot for port prices (Tianjin, Qinzhou, north or south China ports; usually yuan a dry ton unit)" },
      low: { type: "number" }, high: { type: ["number", "null"] },
      currency: { type: "string", enum: ["USD", "CNY"] }, unit: { type: "string", enum: ["t", "dmtu"] },
      quote: { type: "string", description: "The sentence the price is in, copied exactly" } }, required: ["review", "commodity", "grade", "basis", "low", "currency", "unit", "quote"] } } },
    required: ["prices"] } };
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, tools: [tool], tool_choice: { type: "tool", name: "prices" },
      messages: [{ role: "user", content: [{ type: "text", text: content }, { type: "text", text: "These sentences are from Shanghai Metals Market (SMM) ore market reviews. List the prices of SOUTH AFRICAN chrome ore and SOUTH AFRICAN manganese ore only – skip Turkish, Zimbabwean, Gabonese, Australian, Brazilian, Ghanaian and other origins, and skip ferrochrome and other alloy prices. Pick the closest grade from the list; 'fines' concentrate counts as concentrate; South African semi-carbonate is '36–37% semi-carbonate'; South African high-iron and medium-iron are their own grades. Each line holds one price; the words before a colon name the port. When the same grade is priced at north China ports (Tianjin) and south China ports (Qinzhou), list the north China one. Copy the line exactly into quote. Only figures printed in that line; a range gives low and high. If there is no South African ore price, return an empty list." }] }] }) });
  const out = await res.json();
  const v = ((out.content || []).find((c: any) => c.type === "tool_use") || {}).input;
  const rows: any[] = [], fx: Record<string, number | null> = {};
  const nsp = (s: string) => String(s || "").replace(/\s+/g, " ").trim(), canon = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
  const printed = (n: number, q: string) => { const t = q.replace(/[,\s](?=\d{3}\b)/g, ""); return [String(n), n.toFixed(1), n.toFixed(2)].some((x) => t.includes(x)); };
  const sane = (r: any) => r.currency === "USD" ? (r.unit === "t" ? r.low >= 100 && r.low <= 900 : r.low >= 1 && r.low <= 20) : (r.low >= 10 && r.low <= 150);
  // why a figure was left out – kept with the weekly note so a quiet week can be told apart from a fault
  const why = { listed: 0, asText: 0, noReview: 0, requoted: 0, notInArticle: 0, notPrinted: 0, notSaOrOdd: 0 };
  let list: any = v && v.prices;
  if (typeof list === "string") { try { list = JSON.parse(list); why.asText = 1; } catch { list = []; } }   // the list sometimes arrives as text
  for (const p of (Array.isArray(list) ? list : [])) {
    why.listed++;
    const d = docs[(p.review || 1) - 1]; if (!d) { why.noReview++; continue; }
    let q = nsp(p.quote);
    const inText = (x: string) => canon(d.text).includes(canon(x)) || d.lines.some((l) => canon(l).includes(canon(x)));   // the article, or one of its lines
    if (!q || !inText(q)) {   // not copied exactly: use the article's own line that prints these figures
      const own = typeof p.low === "number" ? d.lines.find((l) => printed(p.low, l) && (p.high == null || printed(p.high, l))) : "";
      if (own) { q = nsp(own); why.requoted++; } else { why.notInArticle++; continue; }   // the sentence must be in the article
    }
    if (!printed(p.low, q) || (p.high != null && !printed(p.high, q))) { why.notPrinted++; continue; }         // and the figures in the sentence
    if (!sane(p) || !MKT_SA.test(q)) { why.notSaOrOdd++; continue; }
    const dash = (x: string) => String(x || "").replace(/[\u2012-\u2015-]/g, "-").toLowerCase();
    const grade = MKT_GRADES.find((g) => dash(g) === dash(p.grade)) || String(p.grade || "");   // one spelling per grade
    const gw = (grade.match(/semi-carbonate|high-iron|medium-iron/) || [])[0];
    if (gw && !dash(q).includes(gw)) { why.notSaOrOdd++; continue; }   // a named grade must be the one in the line
    if (!(p.currency in fx)) fx[p.currency] = await fxZar(p.currency);
    rows.push({ commodity: p.commodity, grade, basis: p.basis, price_low: p.low, price_high: p.high != null ? p.high : p.low, currency: p.currency, unit: p.unit,
      effective: d.at, source: "SMM", source_url: d.url, quote: q.slice(0, 500), fx_zar: fx[p.currency], status: "suggested" });
  }
  const newest: Record<string, any> = {}, north = (r: any) => (/north|tianjin/i.test(r.quote) ? 1 : 0);   // north China ports are the usual reference
  for (const r of rows) { const k = `${r.commodity}|${r.grade}|${r.basis}`, o = newest[k]; if (!o || o.effective < r.effective || (o.effective === r.effective && north(r) > north(o))) newest[k] = r; }
  let added = 0;
  for (const r of Object.values(newest)) {
    const { data: had } = await admin.from("market_prices").select("id").eq("commodity", r.commodity).eq("grade", r.grade).eq("basis", r.basis).neq("status", "dropped").gte("effective", r.effective).limit(1);
    if (had && had.length) continue;   // we already have this price or a newer one
    const { error } = await admin.from("market_prices").insert(r); if (!error) added++;
    // an older suggestion for the same ore, grade and basis is replaced by this one
    if (!error) await admin.from("market_prices").update({ status: "dropped" }).eq("commodity", r.commodity).eq("grade", r.grade).eq("basis", r.basis).eq("status", "suggested").lt("effective", r.effective);
  }
  const claude = out && out.error ? String(out.error.message || out.error.type || "error").slice(0, 160) : String((out && out.stop_reason) || "");
  await admin.from("weekly_notes").upsert({ kind: "market", week_ending: today, summary: `${added} new price${added === 1 ? "" : "s"} from ${docs.length} SMM review${docs.length === 1 ? "" : "s"}`, data: { urls: docs.map((d) => d.url), read: rows.length, why, claude }, source_url: SMM }, { onConflict: "kind,week_ending" });
  return { checked: true, added, read: rows.length, why, claude, lines: docs.map((d) => d.lines.length), reviews: docs.map((d) => d.url), prices: await latest() };
}

// ---------------- holidays and weather ----------------
async function holidays() {
  const y = new Date().getUTCFullYear(), out: any[] = [];
  for (const yr of [y, y + 1]) {
    const r = await getJSON(`https://date.nager.at/api/v3/PublicHolidays/${yr}/ZA`);
    if (r.ok && Array.isArray(r.body)) for (const h of r.body) out.push({ date: h.date, name: h.localName || h.name });
  }
  return { holidays: out };
}
async function weather(admin: any, points: any[]) {
  const out: any[] = [];
  for (const p of (points || []).slice(0, 6)) {
    const lat = Math.round(+p.lat * 100) / 100, lon = Math.round(+p.lon * 100) / 100;
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const key = `${lat},${lon}`;
    const { data: c } = await admin.from("weather_cache").select("*").eq("key", key).maybeSingle();
    let data = c && Date.now() - new Date(c.fetched_at).getTime() < 3600e3 ? c.data : null;
    if (!data) {
      const r = await getJSON(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`);
      if (!r.ok) continue;
      data = r.body; await admin.from("weather_cache").upsert({ key, data, fetched_at: new Date().toISOString() });
    }
    // per South African day: rain total (mm) and strongest wind (km/h)
    const days: Record<string, { rain: number; wind: number }> = {};
    for (const t of (data.properties && data.properties.timeseries) || []) {
      const d = new Date(new Date(t.time).getTime() + 2 * 3600e3).toISOString().slice(0, 10);
      const e = days[d] ||= { rain: 0, wind: 0 };
      const n1 = t.data.next_1_hours && t.data.next_1_hours.details && t.data.next_1_hours.details.precipitation_amount;
      if (typeof n1 === "number") e.rain += n1;
      const w = t.data.instant && t.data.instant.details && t.data.instant.details.wind_speed;
      if (typeof w === "number") e.wind = Math.max(e.wind, w * 3.6);
    }
    out.push({ name: p.name || key, lat, lon, days: Object.entries(days).slice(0, 3).map(([date, v]) => ({ date, rain: Math.round(v.rain * 10) / 10, wind: Math.round(v.wind) })) });
  }
  return { weather: out, credit: "Weather: MET Norway (api.met.no)" };
}

// ---------------- phone reminders (web push) ----------------
const APP_URL = "https://cavereef-gif.github.io/deal-board-app/";
async function vapid(admin: any) {
  let { data } = await admin.rpc("vapid_get");
  if (!data || !data.public || !data.private) {
    const k = webpush.generateVAPIDKeys();
    await admin.rpc("vapid_store", { p_public: k.publicKey, p_private: k.privateKey });
    ({ data } = await admin.rpc("vapid_get"));
  }
  return data as { public: string; private: string };
}
// payload: one note for every phone, or a function that picks the note per phone (null = nothing for that phone)
async function sendPush(admin: any, owner: string, payload: Record<string, unknown> | ((sub: any) => Record<string, unknown> | null)) {
  const keys = await vapid(admin);
  const { data: subs } = await admin.from("push_subs").select("*").eq("owner", owner);
  let sent = 0, gone = 0, failed = 0;
  for (const s of subs || []) {
    const p = typeof payload === "function" ? payload(s) : payload;
    if (!p) continue;
    try {
      const d = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p),
        { TTL: 6 * 3600, urgency: "normal", vapidDetails: { subject: APP_URL, publicKey: keys.public, privateKey: keys.private } });
      const r = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body as any });
      if (r.status === 404 || r.status === 410) { await admin.from("push_subs").delete().eq("endpoint", s.endpoint); gone++; }
      else if (r.ok) { await admin.from("push_subs").update({ last_ok: new Date().toISOString(), fails: 0 }).eq("endpoint", s.endpoint); sent++; }
      else { await admin.from("push_subs").update({ fails: (s.fails || 0) + 1 }).eq("endpoint", s.endpoint); failed++; }
    } catch { failed++; }
  }
  return { sent, gone, failed, phones: (subs || []).length };
}
// 3 Oct 2026 (Phone Flow Batch 1, prototype only – Chris: "content-free wording, e.g. '1 deal needs you'. No deal names, amounts
// or people on the lock screen"): a phone running the prototype (its label ends "· prototype") gets only how many deals and
// other tasks need the person today, plus the number of late tasks for the app icon (the app shows the same number on Today's
// Late tile). Every other phone keeps the note it had.
// PROTO-NOTE-START
function protoNote(mine: any[], fu: any[], sugg: number, today: string, due: (i: any) => string) {
  const need = mine.filter((i: any) => due(i) <= today), fuNeed = fu.filter((t: any) => t.not_before <= today).length;
  const deals = new Set(need.filter((i: any) => i.deal_id).map((i: any) => i.deal_id)).size, other = need.filter((i: any) => !i.deal_id).length + fuNeed;
  const late = mine.filter((i: any) => due(i) < today).length + fu.filter((t: any) => t.not_before < today).length;
  const pl = (n: number, one: string, many: string) => n === 1 ? one : many, parts: string[] = [];
  if (deals) parts.push(`${deals} ${pl(deals, "deal needs", "deals need")} you`);
  if (other) parts.push(deals ? `${other} other ${pl(other, "task", "tasks")}` : `${other} ${pl(other, "task needs", "tasks need")} you`);
  if (sugg) parts.push(`${sugg} ${pl(sugg, "suggestion", "suggestions")} to check`);
  return { body: parts.join(" · "), badge: late };
}
const isProtoPhone = (s: any) => /· prototype$/.test(String(s.device || ""));
// PROTO-NOTE-END
async function pushDaily(admin: any) {
  const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  const { data: owners } = await admin.from("allowed_users").select("display_name");
  const { data: items } = await admin.from("items").select("owner,state,due_on,last_chased,created_at,nudge_after_days,priority,deal_id").neq("state", "Done");
  const { data: lts } = await admin.from("lead_tasks").select("owner,status,not_before,outcome").eq("status", "open");   // buyer-search follow-ups
  const out: any = {};
  for (const o of owners || []) {
    const name = o.display_name as string;
    const mine = (items || []).filter((i: any) => ((i.owner || "Chris") === name || i.owner === "Both") && i.state !== "Proposed");   // a task for Both reminds both
    const due = (i: any) => i.due_on || new Date(new Date(i.last_chased || i.created_at).getTime() + (i.nudge_after_days || 3) * 864e5 + 2 * 3600e3).toISOString().slice(0, 10);
    const late = mine.filter((i: any) => due(i) < today).length, now = mine.filter((i: any) => due(i) === today).length;
    const urgent = mine.filter((i: any) => i.priority === 1 && due(i) <= today).length;
    const sugg = (items || []).filter((i: any) => i.state === "Proposed").length;
    const fu = (lts || []).filter((t: any) => ((t.owner || "Chris") === name || t.owner === "Both") && t.not_before && t.outcome);
    const proto = protoNote(mine, fu, sugg, today, due);
    const body = late || now || sugg ? [late ? `${late} late` : "", now ? `${now} due today` : "", urgent ? `${urgent} urgent` : "", sugg ? `${sugg} suggested to check` : ""].filter(Boolean).join(" · ") : "";
    if (!body && !proto.body) { out[name] = "nothing to say"; continue; }
    out[name] = await sendPush(admin, name, (s: any) => isProtoPhone(s)
      ? (proto.body ? { title: "Deal Board", body: proto.body, badge: proto.badge, url: APP_URL + "prototype/", tag: "daily" } : null)
      : (body ? { title: "Deal Board", body, url: APP_URL, tag: "daily" } : null));
  }
  return out;
}

// ---------------- entry ----------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    // who is asking: a signed-in partner, or the app's own monthly timer (a token kept in Vault, lookups only)
    const cron = req.headers.get("x-cron-token") || "";
    let actor = "";
    if (cron) {
      const { data: t } = await admin.rpc("get_tools_cron_token");
      if (!t || t !== cron || !["route", "places", "diesel", "borders", "market", "holidays", "weather", "status", "push_daily"].includes(action)) return json({ error: "Not allowed" }, 403);
      actor = "timer";
    } else {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user?.email) return json({ error: "Not signed in" }, 401);
      const { data: allowed } = await admin.from("allowed_users").select("display_name").eq("email", user.email).maybeSingle();
      if (!allowed) return json({ error: "Not allowed" }, 403);
      actor = allowed.display_name as string;
    }
    const keys: Record<string, string> = {};
    for (const k of ["geoapify", "tomtom"]) { const { data } = await admin.rpc("get_service_key", { p_name: k }); if (data) keys[k] = data as string; }
    if (action === "route") return json({ ok: true, ...(await route(admin, keys, body)) });
    if (action === "places") return json({ ok: true, places: await suggestPlaces(admin, keys, String(body.q || "")) });
    if (action === "diesel") {
      let claudeKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
      if (!claudeKey) { const { data: k } = await admin.rpc("get_bot_key"); claudeKey = (k as string) || ""; }
      return json({ ok: true, ...(await diesel(admin, claudeKey, !!body.force)) });
    }
    if (action === "borders") {
      let claudeKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
      if (!claudeKey) { const { data: k } = await admin.rpc("get_bot_key"); claudeKey = (k as string) || ""; }
      return json({ ok: true, ...(await borders(admin, claudeKey, !!body.force)) });
    }
    if (action === "market") {
      let claudeKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
      if (!claudeKey) { const { data: k } = await admin.rpc("get_bot_key"); claudeKey = (k as string) || ""; }
      return json({ ok: true, ...(await market(admin, claudeKey, !!body.force && actor !== "timer")) });
    }
    if (action === "holidays") return json({ ok: true, ...(await holidays()) });
    if (action === "weather") return json({ ok: true, ...(await weather(admin, body.points || [])) });
    if (action === "push_key") return json({ ok: true, public_key: (await vapid(admin)).public });
    if (action === "push_test") return json({ ok: true, ...(await sendPush(admin, actor, { title: "Deal Board", body: "Reminders work on this phone. You'll get one short note at 07:00 on weekdays.", url: APP_URL, tag: "test" })) });
    if (action === "push_daily") { if (actor !== "timer") return json({ error: "Only the 07:00 timer sends the daily note" }, 403); return json({ ok: true, sent: await pushDaily(admin) }); }
    if (action === "status") return json({ ok: true, actor, keys: { geoapify: !!keys.geoapify, tomtom: !!keys.tomtom } });
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 200);
  }
});
