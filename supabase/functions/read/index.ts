// Record copy of the Supabase edge function `read` (v1, 26 Sep 2026). Deployed from the Claude project, never from this repo.
// Deal Board "reader": Claude reads a photo (notes, whiteboard, business card, screenshot), a document (PDF or photo of a
// contract, assay, invoice, quote), a pasted WhatsApp quote, or a voice-note transcript, and returns SUGGESTIONS only:
// tasks, contacts, notes, deal terms and a tidy quote card. Nothing is saved here – the app shows a review sheet and a
// person ticks what to save. The private target and walk-away limit are never sent and never asked for.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Deal terms Claude may fill in (never target / limit – those are private)
const TERM_KEYS: Record<string, string> = {
  commodity: "Commodity", grade: "Grade / spec", form: "Form (ROM, lumpy, concentrate, fines)", volume: "Volume", term: "Contract length",
  trial: "Trial load", price: "Price", basis: "Incoterm", port: "Named place", unit: "Price unit (per DMT, per WMT, per dmtu)",
  dmt: "How DMT is worked out", inspector: "Inspector and who pays", weights: "Which weight counts", final_assay: "Which assay is final",
  umpire: "Umpire lab and splitting limit", vat: "VAT", seller: "Seller", buyer: "Buyer", instrument: "Payment instrument",
  commission: "Commission", cargo: "Cargo (transport)", route: "Route (transport, from → to)", distance: "Distance", trucks: "Trucks",
  client_rate: "Client rate (transport)", haulier_rate: "Transporter rate", loads: "Loads", payment: "Payment terms", extras: "Extras / inclusions",
};

const REPORT_TOOL = {
  name: "report",
  description: "Report what you read, as suggestions for the user to review. Only include what the source really says; leave fields empty rather than guess.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two short plain-English lines: what this is and the main point." },
      tasks: {
        type: "array", description: "Things to do or to wait for. One short line each.",
        items: {
          type: "object",
          properties: {
            what: { type: "string", description: "The task in a few words, e.g. 'Send the truck list' or 'Signed NCNDA'" },
            waiting_on: { type: "string", description: "'Me' when it is our own job; otherwise the person or company we wait on" },
            owner: { type: "string", enum: ["Chris", "Annemarie"], description: "Who of us does or chases it (default: the person who sent this)" },
            due: { type: "string", description: "YYYY-MM-DD if a date or day is stated or clearly implied, else empty" },
            deal: { type: "string", description: "Exact deal name from DEALS if it clearly belongs to one, else empty" },
            why: { type: "string", description: "The words in the source this comes from (short)" },
          },
          required: ["what", "waiting_on", "owner"],
        },
      },
      contacts: {
        type: "array", description: "People or companies with contact details (a business card = one contact).",
        items: { type: "object", properties: { name: { type: "string" }, company: { type: "string" }, role: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, notes: { type: "string" } }, required: ["name"] },
      },
      notes: {
        type: "array", description: "Facts worth keeping (numbers, promises, decisions). One short line each.",
        items: { type: "object", properties: { text: { type: "string" }, deal: { type: "string", description: "Exact deal name from DEALS, or empty" }, contact: { type: "string", description: "Exact contact name from CONTACTS, or empty" } }, required: ["text"] },
      },
      terms: {
        type: "array", description: "Deal terms stated in the source (only these keys).",
        items: { type: "object", properties: { key: { type: "string", enum: Object.keys(TERM_KEYS) }, value: { type: "string", description: "Short value as written, e.g. 'USD 180 / dmt' or 'FCA Mooinooi plant'" }, evidence: { type: "string", description: "The exact words it comes from (short)" } }, required: ["key", "value"] },
      },
      quote: {
        type: "object", description: "Only for a price quote, offer or request.",
        properties: {
          is_quote: { type: "boolean" },
          side: { type: "string", enum: ["offer", "request", "unknown"], description: "offer = someone selling or quoting a rate to us; request = someone wanting to buy or wanting transport" },
          from_who: { type: "string" }, product: { type: "string" }, grade: { type: "string" }, quantity: { type: "string" },
          price: { type: "string", description: "Number and currency exactly as stated" }, unit: { type: "string", description: "per ton, per DMT, per load …" },
          vat: { type: "string", description: "incl / excl / not stated" }, basis: { type: "string", description: "Incoterm or FOT / delivered / collected" },
          place: { type: "string", description: "Named place, plant, port or town" }, transport_from: { type: "string" }, transport_to: { type: "string" },
          payment: { type: "string" }, validity: { type: "string" }, other: { type: "string" },
          missing: { type: "array", items: { type: "string" }, description: "Essentials NOT stated, in plain words, e.g. 'VAT included or not', 'Payment terms', 'How long the price is valid', 'Moisture / DMT basis'" },
        },
        required: ["is_quote"],
      },
    },
    required: ["summary", "tasks", "contacts", "notes", "terms"],
  },
};

const HOW: Record<string, string> = {
  photo: "The image is a photo of handwritten notes, a whiteboard, a business card or a screenshot. Read every word carefully (handwriting may be messy – if a word is unclear, write your best reading with a question mark). A business card becomes one contact. Notes become tasks (things to do or wait for), notes (facts) and contacts.",
  document: "This is a deal document: a contract, offer (LOI, ICPO, FCO), assay or inspection certificate, invoice, quote, bank letter or similar. Extract the deal terms (only the keys given) with the exact words as evidence; dates and deadlines as tasks (e.g. 'Payment due', 'Offer expires'); a short note of anything important that is not a term (e.g. assay results, parties, red flags such as an unverifiable bank or up-front fees). Contacts only if contact details are printed.",
  quote: "This is a WhatsApp message (or several) that is probably a price quote, offer or request – chrome or manganese ore, or a transport rate. Fill the quote card exactly as stated; never invent numbers. List in 'missing' every essential that is not stated: VAT included or not, Incoterm / delivery basis and the named place, payment terms, how long the price is valid, quantity, spec / grade, who pays transport and loading, and for ore the moisture / DMT basis and which assay counts. Suggest tasks that are questions to ask back for the missing essentials (waiting_on = the sender if known, owner = the user). Also fill terms with what is stated.",
  voice: "This is a transcript of a voice note the user just recorded (speech-to-text, so expect small mistakes). Turn it into tasks (our own jobs = waiting_on 'Me'; things we wait for from someone = that person), notes (facts, numbers, promises) and contacts (only if a number or email is spoken).",
};

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
    const text = String(body.text || "").slice(0, 20000);
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
    const system = `You read material for Deal Board, the work app of Chris and Annemarie, two business partners in Durban, South Africa. They broker road-transport loads and chrome / manganese ore deals (company: Verve Africa).
${HOW[kind]}
The user is ${actor}. Today is ${todayTxt}. Use South African meanings (R = rand, ton = metric ton, DMT = dry metric ton).
Rules: suggestions only – the user reviews every line before anything is saved. Never invent names, numbers or dates. Keep every line short and in plain English. Never ask for or mention the private target price or walk-away limit.
DEALS (exact names): ${deals.map((d) => `${d.name} [${d.kind}, ${d.area}]`).join(" | ") || "none"}
CONTACTS (exact names): ${contacts.map((c) => c.name + (c.company ? ` (${c.company})` : "")).join(" | ") || "none"}
PEOPLE WE ALREADY WAIT ON: ${waitNames.join(" | ") || "none"}
${aboutDeal ? `The user says this is about the deal "${aboutDeal.name}" – use that deal name for tasks and notes unless the source clearly says otherwise.` : ""}${aboutContact ? `The user says this is about the contact "${aboutContact.name}".` : ""}
Deal term keys you may use: ${Object.entries(TERM_KEYS).map(([k, v]) => `${k} = ${v}`).join("; ")}.
Answer only by calling the report tool.`;

    const content: unknown[] = [];
    if (file && file.data) {
      const mt = String(file.media_type || "");
      if (mt === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } });
      else if (/^image\/(jpeg|png|gif|webp)$/.test(mt)) content.push({ type: "image", source: { type: "base64", media_type: mt, data: file.data } });
      else return json({ error: "Use a photo (JPG or PNG) or a PDF." }, 400);
    }
    content.push({ type: "text", text: kind === "quote" ? `WhatsApp message(s):\n"""\n${text}\n"""` : kind === "voice" ? `Voice note transcript:\n"""\n${text}\n"""` : (text ? `Extra words from the user: ${text}\n` : "") + (file?.name ? `File name: ${file.name}` : "Read it.") });

    const model = kind === "photo" || kind === "document" ? VISION_MODEL : TEXT_MODEL;
    const resp = await anthropic(key, { model, max_tokens: 3000, system, tools: [REPORT_TOOL], tool_choice: { type: "tool", name: "report" }, messages: [{ role: "user", content }] });
    const use = (resp.content || []).find((c: { type: string }) => c.type === "tool_use");
    if (!use) return json({ error: "The reader gave no answer – try again." }, 502);
    const out = use.input || {};
    // map names back to ids so the app can save in one tap (the user still reviews each line)
    const dealId = (n: string) => (deals.find((d) => d.name === n) || (aboutDeal && !n ? aboutDeal : null))?.id || "";
    const contactId = (n: string) => contacts.find((c) => c.name === n)?.id || "";
    for (const t of out.tasks || []) t.deal_id = dealId(t.deal || "");
    for (const n of out.notes || []) { n.deal_id = n.deal ? dealId(n.deal) : ""; n.contact_id = n.contact ? contactId(n.contact) : ""; }
    for (const t of out.terms || []) t.label = TERM_KEYS[t.key] || t.key;
    // never pass private terms back, even if the model tried
    out.terms = (out.terms || []).filter((t: { key: string }) => t.key !== "target" && t.key !== "limit");
    return json({ ...out, model: resp.model || model, usage: resp.usage || null });
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500);
  }
});
