// Record copy of the Supabase edge function `read` (v2, 27 Sep 2026: messy WhatsApps split into loads; no placeholder names). Deployed from the Claude project, never from this repo.
// Deal Board "reader": Claude reads a photo (notes, whiteboard, business card, screenshot), a document (PDF or photo of a
// contract, assay, invoice, quote), a pasted WhatsApp quote, or a voice-note transcript, and returns SUGGESTIONS only:
// tasks, contacts, notes, deal terms and a tidy quote card. Nothing is saved here – the app shows a review sheet and a
// person ticks what to save. The private target and walk-away limit are never sent and never asked for.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { TERM_KEYS, REPORT_TOOL, HOW, buildSystem, isPlaceholderName } from "./prompt.ts";

const VISION_MODEL = Deno.env.get("READ_MODEL") || "claude-sonnet-5";        // photos and documents
const TEXT_MODEL = Deno.env.get("READ_TEXT_MODEL") || "claude-haiku-4-5-20251001"; // quotes and voice notes (cheaper)
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function anthropic(key: string, body: Record<string, unknown>) {
  const call = async (b: Record<string, unknown>) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(b),
    });
    return { ok: r.ok, status: r.status, data: await r.json() };
  };
  let res = await call(body);
  // if the chosen model is not available on this key, fall back to Haiku (it reads photos and PDFs too)
  if (!res.ok && body.model !== FALLBACK_MODEL && (res.status === 404 || /model/i.test(res.data?.error?.message || ""))) res = await call({ ...body, model: FALLBACK_MODEL });
  if (!res.ok) { const m = res.data?.error?.message || `Anthropic API ${res.status}`; throw new Error(/x-api-key|authentication/i.test(m) ? "The saved bot key is not valid. More › Settings › Bot key." : m); }
  return res.data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "Not signed in" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: allowed } = await admin.from("allowed_users").select("display_name").eq("email", user.email).maybeSingle();
    if (!allowed) return json({ error: "Not allowed" }, 403);
    const actor = allowed.display_name as string;

    let key = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!key) { const { data: k } = await admin.rpc("get_bot_key"); key = (k as string) || ""; }
    if (!key) return json({ error: "The bot has no key yet – add it in More › Settings." }, 400);

    const body = await req.json();
    const kind = String(body.kind || "");
    if (!HOW[kind]) return json({ error: "Unknown kind" }, 400);
    const text = String(body.text || "").slice(0, 30000);
    const file = body.file as { data?: string; media_type?: string; name?: string } | undefined;
    if ((kind === "photo" || kind === "document") && !(file && file.data)) return json({ error: "No file received" }, 400);
    if (file && file.data && file.data.length > 9_000_000) return json({ error: "The file is too big – use one under 6 MB." }, 413);

    // Context: names only (no deal terms, no private numbers)
    const [dealsR, contactsR, itemsR] = await Promise.all([
      admin.from("deals").select("id,name,kind,area,status").in("status", ["Active", "On hold"]).order("sort"),
      admin.from("contacts").select("id,name,company").order("name").limit(400),
      admin.from("items").select("waiting_on").neq("state", "Done").limit(400),
    ]);
    const deals = (dealsR.data || []) as { id: string; name: string; kind: string; area: string }[];
    const contacts = (contactsR.data || []) as { id: string; name: string; company: string }[];
    const waitNames = [...new Set(((itemsR.data || []) as { waiting_on: string }[]).map((i) => i.waiting_on).filter((w) => w && w !== "Me"))];
    const about = String(body.about || "");   // "deal:<id>" or "contact:<id>" chosen by the user
    const aboutDeal = about.startsWith("deal:") ? deals.find((d) => d.id === about.slice(5)) : null;
    const aboutContact = about.startsWith("contact:") ? contacts.find((c) => c.id === about.slice(8)) : null;

    const today = new Date(Date.now() + 2 * 3600e3);   // South Africa time
    const todayTxt = today.toISOString().slice(0, 10) + " (" + today.toLocaleDateString("en-ZA", { weekday: "long", timeZone: "UTC" }) + ")";
    const system = buildSystem({ kind, actor, todayTxt, deals, contacts, waitNames, aboutDeal, aboutContact });

    const content: unknown[] = [];
    if (file && file.data) {
      const mt = String(file.media_type || "");
      if (mt === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } });
      else if (/^image\/(jpeg|png|gif|webp)$/.test(mt)) content.push({ type: "image", source: { type: "base64", media_type: mt, data: file.data } });
      else return json({ error: "Use a photo (JPG or PNG) or a PDF." }, 400);
    }
    content.push({ type: "text", text: kind === "quote" ? `WhatsApp message(s):\n"""\n${text}\n"""` : kind === "voice" ? `Voice note transcript:\n"""\n${text}\n"""` : (text ? `Extra words from the user: ${text}\n` : "") + (file?.name ? `File name: ${file.name}` : "Read it.") });

    const model = kind === "photo" || kind === "document" ? VISION_MODEL : TEXT_MODEL;
    const resp = await anthropic(key, { model, max_tokens: 4000, system, tools: [REPORT_TOOL], tool_choice: { type: "tool", name: "report" }, messages: [{ role: "user", content }] });
    const use = (resp.content || []).find((c: { type: string }) => c.type === "tool_use");
    if (!use) return json({ error: "The reader gave no answer – try again." }, 502);
    const out = use.input || {};
    // map names back to ids so the app can save in one tap (the user still reviews each line)
    const dealId = (n: string) => (deals.find((d) => d.name === n) || (aboutDeal && !n ? aboutDeal : null))?.id || "";
    const contactId = (n: string) => contacts.find((c) => c.name === n)?.id || "";
    for (const t of out.tasks || []) t.deal_id = dealId(t.deal || "");
    for (const l of out.loads || []) {
      l.deal_id = l.deal ? dealId(l.deal) : "";
      // "not stated" / "unknown" in a field means empty – the app asks for it instead
      for (const k of ["side", "from", "to", "commodity", "trucks", "rate", "unit", "vat", "volume", "payment", "start", "extras", "contact"]) if (typeof l[k] === "string" && isPlaceholderName(l[k])) l[k] = "";
      l.missing = (l.missing || []).filter((q: string) => q && q.trim());
      l.flags = (l.flags || []).filter((q: string) => q && q.trim());
    }
    for (const t of out.tasks || []) if (t.waiting_on !== "Me" && isPlaceholderName(t.waiting_on)) t.waiting_on = "";
    // a contact needs a real name or a number – never "<UNKNOWN>" or "Sender"
    out.contacts = (out.contacts || []).map((c: { name: string; phone?: string; email?: string }) => (isPlaceholderName(c.name) ? { ...c, name: "" } : c))
      .filter((c: { name: string; phone?: string; email?: string }) => c.name || c.phone || c.email);
    for (const n of out.notes || []) { n.deal_id = n.deal ? dealId(n.deal) : ""; n.contact_id = n.contact ? contactId(n.contact) : ""; }
    for (const t of out.terms || []) t.label = TERM_KEYS[t.key] || t.key;
    // never pass private terms back, even if the model tried
    out.terms = (out.terms || []).filter((t: { key: string }) => t.key !== "target" && t.key !== "limit");
    return json({ ...out, model: resp.model || model, usage: resp.usage || null });
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500);
  }
});
