// Record copy of the deployed Supabase edge function `ask` (v10, 26 Sep 2026). One example name was replaced because this repo is public.
// v10: app_action tool for the v17 app (sent app:2) – open/show/calculator at once, changes only prepared ("Do it" in the app).
// Older apps (no app flag) get exactly the v9 tools. propose_item takes an optional due date; the board lists due dates.
// Deploying needs Supabase access (done from the Claude project), never from this repo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Deal Board bot. Answers questions, drafts follow-ups, updates next steps, proposes items/notes and
// suggests info edits. It never confirms, completes, ticks checklist steps or deletes: humans do that in the app.
const MODEL = Deno.env.get("BOT_MODEL") || "claude-haiku-4-5-20251001";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TERM_LABELS: Record<string, string> = {
  commodity: "Commodity", grade: "Grade/spec", form: "Form", volume: "Volume", term: "Contract length", trial: "Trial load",
  price: "Price", basis: "Price basis", port: "Delivery point/port", vat: "VAT", seller: "Seller", seller_chain: "Seller-side chain",
  buyer: "Buyer", buyer_chain: "Buyer-side chain", instrument: "Payment instrument", commission: "Our commission/margin",
  other_cuts: "Other parties' cuts", cuts: "Other parties' cuts", target: "OUR TARGET (private)", limit: "WALK-AWAY LIMIT (private)",
  cargo: "Cargo", route: "Route", distance: "Distance", trucks: "Trucks", client_rate: "Client rate", haulier_rate: "Transporter rate",
  loads: "Loads", payment: "Payment terms", extras: "Extras/inclusions",
  unit: "Price unit", dmt: "How DMT is worked out", inspector: "Inspector and who pays", weights: "Which weight counts",
  final_assay: "Which assay is final", umpire: "Umpire lab and splitting limit",
};
const ROUTE_LABELS: Record<string, string> = { local: "local sale by truck (FOT/FCA/DAP)", bulk: "export by sea, bulk ship (FOB/CFR/CIF)", container: "export in containers (FCA/CPT/CIP)", road: "export by road to a neighbouring country (FCA/DAP)" };

const TOOLS = [
  {
    name: "propose_item",
    description: "Propose a new wait or task on the board. It appears as Proposed until a human confirms it. Use when the user reports something new that is being waited on, or asks you to add a task.",
    input_schema: {
      type: "object",
      properties: {
        project: { type: "string", enum: ["Transport", "Chrome", "Manganese", "Buyer search", "Verve admin", "Other"] },
        deal: { type: "string", description: "Exact deal name from the DEALS list if the item belongs to a deal" },
        waiting_on: { type: "string", description: "Person or party we wait on, or 'Me' for our own task" },
        waiting_for: { type: "string", description: "What we are waiting for, one line" },
        blocks: { type: "string", description: "What cannot move until this arrives" },
        next_action: { type: "string" },
        priority: { type: "integer", enum: [1, 2, 3], description: "1 high, 2 normal, 3 low" },
        owner: { type: "string", enum: ["Chris", "Annemarie"] },
        due: { type: "string", description: "Due date YYYY-MM-DD when the user gives a day (e.g. 'on Tuesday' = the coming Tuesday)" },
      },
      required: ["project", "waiting_on", "waiting_for"],
    },
  },
  {
    name: "add_note",
    description: "Attach a note to an existing item (item_id), deal (deal_id), directory lead (lead_id) or contact (contact_id), using ids from the board. Use to record news the user gives you. Does not change any state.",
    input_schema: { type: "object", properties: { item_id: { type: "string" }, deal_id: { type: "string" }, lead_id: { type: "string" }, contact_id: { type: "string" }, note: { type: "string" } }, required: ["note"] },
  },
  {
    name: "set_next_action",
    description: "Update the 'next step' text of an existing item (by id). Use when the user agrees a next step, or when the current next step is empty or out of date. Keep it one short line, e.g. 'WhatsApp the client Mon 29 Sep'.",
    input_schema: { type: "object", properties: { item_id: { type: "string" }, next_action: { type: "string" } }, required: ["item_id", "next_action"] },
  },
  {
    name: "add_contact",
    description: "Save a contact card (name, phone/WhatsApp, email, company, role, project) when the user gives you someone's details. Update by name if the contact already exists.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, phone: { type: "string" }, whatsapp: { type: "string", description: "international format digits only, e.g. 27821234567" }, email: { type: "string" }, company: { type: "string" }, role: { type: "string" }, project: { type: "string" }, notes: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "suggest_info_update",
    description: "Suggest a change to the background info of a deal or of a general area card. The user sees it with an Apply button; nothing changes until they tap it. Use for status notes, new key facts, new contacts or a new next milestone.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Exact deal name from DEALS, or area name from AREA INFO" },
        field: { type: "string", enum: ["stage", "summary", "key_facts", "contacts", "next_milestone"] },
        text: { type: "string", description: "For key_facts and contacts: the ONE line to add. For stage, summary, next_milestone: the full new text." },
        mode: { type: "string", enum: ["append", "replace"], description: "append adds a line (key_facts/contacts); replace overwrites the field" },
      },
      required: ["target", "field", "text", "mode"],
    },
  },
  {
    name: "suggest_lead_update",
    description: "Suggest a change to a DIRECTORY lead (lead_id from LEADS). The user sees it with an Apply button; nothing changes until they tap it. Use for status (new, ready, contacted, replied, qualified, deal, parked, bounced, skip, dnd), next contact details, or a one-line outcome.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        field: { type: "string", enum: ["status", "outcome", "phone", "email", "person", "grade", "volume", "terms", "flag"] },
        value: { type: "string" },
        note: { type: "string", description: "Why, in a few words" },
      },
      required: ["lead_id", "field", "value"],
    },
  },
];

const TERM_KEYS = Object.keys(TERM_LABELS).filter((k) => k !== "target" && k !== "limit");
const APP_TOOL = {
  name: "app_action",
  description: "Act in the Deal Board app for the user. do=open, show or calculator happens at once: the app opens it. do=change is only PREPARED: the user sees your label with a 'Do it' button and nothing changes until they tap it. One call per action; several calls are fine. Always give a short plain label.",
  input_schema: {
    type: "object",
    properties: {
      do: { type: "string", enum: ["open", "show", "calculator", "change"] },
      target_type: { type: "string", enum: ["deal", "item", "lead", "contact", "view"], description: "What it is about. view = a page of the app." },
      target_id: { type: "string", description: "deal_id, item id, lead_id, the contact's name, or for view one of: today, deals, contacts, board, calculators, guides, archive, settings" },
      deal_tab: { type: "string", enum: ["steps", "numbers", "notes"], description: "open: show the deal on this tab" },
      section: { type: "string", description: "show: All, Chrome, Manganese, Transport or another section (deal area)" },
      tile: { type: "string", enum: ["urgent", "overdue", "today", "week", "none"], description: "show: only these tasks on Today" },
      change: { type: "string", enum: ["due", "priority", "owner", "chased", "done", "drop_item", "confirm_item", "follow_up", "tick_step", "untick_step", "term", "deal_status", "new_deal", "board_post"] },
      value: { type: "string", description: `due: YYYY-MM-DD (empty clears). priority: urgent | normal | low. owner: Chris | Annemarie. follow_up: YYYY-MM-DD|what happened (on an item or a lead). term: key=value, key one of ${TERM_KEYS.join(", ")} (never target or limit). deal_status: Active | On hold | Won | Lost. new_deal: deal name|section. board_post: the message text (target_type deal + deal_id links it to a deal).` },
      step: { type: "string", description: "tick_step / untick_step: the exact step title from the deal's checklist (target_type deal, target_id deal_id)" },
      proof: { type: "string", description: "tick_step: the proof the user gave, if any" },
      calc: { type: "object", description: "calculator: numbers for the transport calculator", properties: { from: { type: "string" }, to: { type: "string" }, km: { type: "number" }, rate_km: { type: "number" }, tolls: { type: "number" }, tons_per_load: { type: "number" }, client_per_ton: { type: "number" }, loads_per_month: { type: "number" } } },
      label: { type: "string", description: "One short plain line, e.g. 'Open the deal Chrome – Example stockpile' or 'Move \"Sigma check\" to Mon 28 Sep'" },
    },
    required: ["do", "label"],
  },
};
const APP_RULES = (todayLong: string) => `
- You can act in the app with app_action. When the user asks to open, show, find, pull up or bring up something (a deal, a task, a lead, a contact, a page, a section, overdue or urgent tasks), call app_action with do=open or do=show and the right id, then answer in one short line ("Opening the Piet deal."). For numbers on a transport route, call do=calculator.
- When the user asks to change something – a due date, urgent or not, who does it, a follow-up, chased today, ticking or unticking a checklist step, a term, the deal status, a new deal, a board message, accepting, dropping or finishing a task – prepare it with app_action do=change and end with "Tap Do it to save." Never say it is done. One change per call.
- New tasks and waits still go through propose_item (they arrive as Suggested); give due when a day is named.
- Never set or reveal the private target or walk-away numbers. Never send messages; drafts are for the user to send.
- Dates: today is ${todayLong}. A weekday name means the next one to come (today counts only if the user says today). Write dates as YYYY-MM-DD in app_action.`;

const BRIEF_TOOL = {
  name: "write_brief",
  description: "Write today's brief as structured data so every line can be tapped in the app. Use only ids that appear on the board.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One plain sentence, at most 30 words: what matters most today." },
      chase_order: { type: "array", items: { type: "string" }, description: "item ids to chase today, most urgent first. Only items waiting on other people, not Proposed ones." },
      risks: {
        type: "array",
        description: "Up to 5 contradictions or risks, one short line each, tied to where they live.",
        items: { type: "object", properties: { text: { type: "string" }, ref_type: { type: "string", enum: ["item", "deal", "lead"] }, ref_id: { type: "string" } }, required: ["text", "ref_type", "ref_id"] },
      },
      drafts: {
        type: "array",
        description: "One short WhatsApp draft per person to chase today, saved on that person's most urgent item (ref_type item). If one person has several open items, one draft covering all of them.",
        items: { type: "object", properties: { ref_type: { type: "string", enum: ["item", "deal", "lead"] }, ref_id: { type: "string" }, to: { type: "string", description: "First name of the person" }, text: { type: "string" } }, required: ["ref_type", "ref_id", "to", "text"] },
      },
    },
    required: ["summary", "chase_order", "risks", "drafts"],
  },
};

function leadText(l: any, people: any[] = [], tasks: any[] = []) {
  const ps = people.filter((p) => p.lead_id === l.id).map((p) => `${p.name}${p.title ? " (" + p.title + ")" : ""}${p.email ? " " + p.email : ""}`).join("; ");
  const ts = tasks.filter((t) => (t.lead_ids || []).includes(l.id) && t.status === "open").map((t) => t.task).join("; ");
  return `- lead_id=${l.id} | ${l.name} | ${l.side}/${l.kind} | ${l.country} | ${l.commodity} | status ${l.status}${l.outcome ? " (" + l.outcome + ")" : ""}${l.grade ? " | wants/offers: " + [l.grade, l.volume, l.terms].filter(Boolean).join("; ") : ""}${l.phone || l.email ? " | contact on file" : " | no contact yet"}${l.flag ? " | WARNING: " + l.flag : ""}${ps ? " | people: " + ps : ""}${ts ? " | next steps: " + ts : ""}${l.about ? " | notes: " + String(l.about).slice(0, 400) : ""}`;
}

const days = (it: any) => Math.max(0, Math.floor((Date.now() - new Date(it.last_chased || it.created_at).getTime()) / 86400000));
const pr = (n: number) => (n === 1 ? "HIGH" : n === 3 ? "low" : "normal");

function dealText(d: any, steps: any[]) {
  const st = steps.filter((s) => s.deal_id === d.id).sort((a, b) => a.sort - b.sort);
  const done = st.filter((s) => s.status !== "open").length;
  const stages: [string, any[]][] = [];
  for (const s of st) { const last = stages[stages.length - 1]; if (last && last[0] === s.stage) last[1].push(s); else stages.push([s.stage, [s]]); }
  const cur = stages.find(([, arr]) => arr.some((s) => s.status === "open"));
  const lines = stages.map(([stage, arr]) => `  ${stage}: ` + arr.map((s) => `[${s.status === "done" ? "x" : s.status === "na" ? "n/a" : " "}] ${s.title}${s.evidence ? ` (proof: ${s.evidence})` : ""}${s.status === "open" && s.closes_with && cur && cur[0] === stage ? ` (closes with: ${s.closes_with})` : ""}`).join("; "));
  const params = d.params || {};
  const set = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${TERM_LABELS[k] || k}: ${v}`);
  const kit = d.kit ? `Checklist: SA deal kit${d.kit_route ? `, route ${ROUTE_LABELS[d.kit_route] || d.kit_route}` : ""}\n` : (st.length ? "Checklist: old short list (the app offers a switch to the SA deal kit)\n" : "");
  return `## DEAL "${d.name}" (deal_id=${d.id}) — area ${d.area}, type ${d.kind}, status ${d.status}\n` + kit +
    `Terms: ${set.length ? set.join(" | ") : "none set"}\n` +
    (st.length ? `Checklist ${done}/${st.length} ticked; current stage: ${cur ? cur[0] : "all done"}\n${lines.join("\n")}\n` : "") +
    `Background: ${d.summary}\nStatus note: ${d.stage}\nKey facts:\n${d.key_facts}\nContacts:\n${d.contacts}\nNext milestone: ${d.next_milestone}`;
}

function boardText(items: any[], deals: any[], steps: any[], areas: any[], today: string, contacts: any[] = []) {
  const dealName = (id: string) => (deals.find((d) => d.id === id) || {}).name || "none";
  const lines = items.map((it) =>
    `- id=${it.id} | deal: ${dealName(it.deal_id)} | ${it.project} | waiting on: ${it.waiting_on} | for: ${it.waiting_for}` +
    (it.blocks ? ` | blocks: ${it.blocks}` : "") + (it.next_action ? ` | next: ${it.next_action}` : "") +
    ` | ${pr(it.priority)} | owner: ${it.owner} | state: ${it.state}${it.due_on ? ` | due ${it.due_on}` : ""} | ${days(it)} days since last chase${days(it) >= (it.nudge_after_days || 3) ? " (STALE)" : ""}`
  );
  const area = areas.map((p) =>
    `## AREA ${p.name} — ${p.stage || "not set"}\n${p.summary}\nKey facts:\n${p.key_facts}\nContacts:\n${p.contacts}\nNext milestone: ${p.next_milestone}`
  );
  const cts = contacts.map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ""}${c.role ? ` — ${c.role}` : ""}${c.project ? ` [${c.project}]` : ""}${c.phone || c.whatsapp ? " — number on file" : " — no number on file"}${c.notes ? ` — ${c.notes}` : ""}`);
  const live = deals.filter((d) => d.status === "Active" || d.status === "On hold");
  const closed = deals.filter((d) => !(d.status === "Active" || d.status === "On hold"));
  return `Today: ${today}\n\n# DEALS (${live.length} active${closed.length ? `, ${closed.length} closed: ${closed.map((d) => d.name + " (" + d.status + ")").join(", ")}` : ""})\n${live.map((d) => dealText(d, steps)).join("\n\n") || "(none)"}\n\n` +
    `# AREA INFO (general, not tied to one deal)\n${area.join("\n\n")}\n\n` +
    `# CONTACTS (${contacts.length}; numbers are kept out of this list)\n${cts.join("\n") || "(none)"}\n\n# OPEN ITEMS / WAITS (${items.length})\n${lines.join("\n")}`;
}

const SYSTEM = (actor: string, board: string, notes: string) => `You are the Deal Board assistant for a small South African commodities and transport brokerage (Verve). You are talking to ${actor}.

What you do: answer questions about the board and the deals, say what to chase first and why, draft short WhatsApp messages, spot contradictions and risks, say what is still missing on a deal's checklist, keep next steps current (set_next_action), record news (add_note), save people's details (add_contact), propose new items (propose_item) and suggest info edits (suggest_info_update).

How the board works: each deal is its own project with Terms (price, basis, instrument, commission and so on), a Checklist of steps grouped in stages, waits (items), notes and files. Humans tick checklist steps in the app; you never say a step is ticked unless the board shows [x].

Rules:
- Plain language, short. Phone reader. No markdown tables, no headings, no bold. Use short numbered lists when listing.
- Rand figures with R. Dates as e.g. 25 Sep.
- Never say something is done, confirmed or received. You only propose; humans confirm in the app.
- Never invent facts. If the board does not say, say so and ask one question.
- When the user gives news about an item or deal, record it with add_note and, if it changes the next step, set_next_action. If it changes background facts, suggest_info_update. Then say what you did in one line.
- When asked what is missing on a deal, list the open steps of the current stage first, then open steps of earlier stages.
- If the user is about to do something that belongs to a later stage (share truck packs or tracker logins, pay or accept fees, sign an SPA, load material) while earlier stages still have open steps, warn them and name those open steps.
- OUR TARGET and WALK-AWAY LIMIT are private. Never put them, or anything that reveals them, in a message meant for a third party.
- Keep counterparty names and deal terms out of anything meant for third parties unless the user asks.
- Broker rule: Verve introduces and facilitates; it does not buy, own or invoice for material. Do not draft anything that says otherwise.
- Safety rule for transport deals: no tracker logins, truck packs or fees before a signed contract and a paid trial load.
- Daily brief: always delivered with the write_brief tool (summary, chase order, risks, WhatsApp drafts). WhatsApp drafts never go in the summary.

South African deal kit (researched 25 Sep 2026) – use this when advising on mineral deals:
- Order: enquiry → NCNDA before names → commission agreement signed by the party who pays → KYC (CIPC; mining right or permit checked via MPTRO copy or DMPR map; chain of custody if the seller is not the right holder; TCS PIN on eFiling; bank letter; SARS exporter code and clearing agent for export) → LOI/ICPO and FCO → proof of product → SPA → payment security → trial → logistics → loading → documents and payment → commission.
- When the assays happen: Assay 1 before the SPA, taken by the buyer's inspector with sealed splits (never rely on the seller's own certificate). Export bulk: TML test within 6 months and moisture sampled no more than 7 days before loading. Assay 2 at loading (local: each lot, trucks weighed at both ends; bulk: stream sampling plus draft survey; containers: at stuffing). Certificates in about 48 hours. Assay 3: results swapped, umpire lab only if outside the splitting limit (suggest 0.3–0.5% Cr2O3). Assay 4: discharge-port results 2–6 weeks after discharge, only if the SPA uses them. Standards: chrome ISO 6153/6154, manganese ISO 4296-1/-2.
- Incoterms: always "[term] [named place] Incoterms 2020". FOT is not an Incoterm – write FCA at the plant or define FOT in the SPA. FOB, CFR and CIF are for bulk ships only; containers use FCA, CPT or CIP. Avoid EXW and DDP. Local DAP: "tipped at buyer's stockpile" and say which weighbridge counts. Incoterms do not decide title or payment – the SPA does.
- Payment security: local = TradeSafe escrow or pay before each batch; export = irrevocable LC (MT700), ideally confirmed by an SA bank, checked before loading. MT103, MT199/MT799 "pre-advice", RWA letters and leased SBLCs are not security; an SBLC is only a backstop.
- Chrome export: on 25 Sep 2026 no ITAC permit and no export tax are in force (draft Notice 6712 only). Export SPAs need a change-in-law clause. Manganese has no export control. Tell the user to re-check ITAC's gazette list before each shipment.
- Commission: typically R30–R50 per DMT; DMT = wet tonnes × (1 − moisture); payable on paid and delivered tonnes; a claim prescribes after 3 years.
- Red flags: no mining right in the seller's name; a prospecting right or small mining permit selling big tonnages; wash plant without environmental authorisation or water use licence; night loading without papers; only the seller's own lab certificate; up-front fees; screenshot proof of funds; bank account changes; "FOB" without an exporter code, clearing agent or terminal; anyone selling an "ITAC permit"; a seller refusing a legal-origin warranty.
- Each open step in the current stage shows "closes with" – the document that proves it. When asked what is missing, name that document. You never tick steps.

${board}

# RECENT NOTES
${notes}`;

async function anthropic(key: string, body: unknown) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) { const m = data?.error?.message || `Anthropic API ${r.status}`; throw new Error(/x-api-key|authentication/i.test(m) ? "The saved bot key is not valid. Open Bot, tap the key box and paste a key that starts with sk-ant-." : m); }
  return data;
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
    const actor = allowed.display_name;

    let key = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!key) { const { data: k } = await admin.rpc("get_bot_key"); key = (k as string) || ""; }
    if (!key) return json({ answer: "The bot is not switched on yet. Paste your Anthropic API key in the box below (Set API key) and try again.", actions: [] });

    const { question = "", mode = "ask", history = [], focus = "", chat = null, app = 0 } = await req.json().catch(() => ({}));
    const appV = Number(app) || 0;   // 2 = the v17 app, which can open things and show "Do it" cards
    const [{ data: items }, { data: projects }, { data: notes }, { data: contacts }, { data: deals }, { data: steps }] = await Promise.all([
      admin.from("items").select("*").neq("state", "Done").order("priority").order("created_at"),
      admin.from("projects").select("*").order("sort"),
      admin.from("events").select("item_id,deal_id,field,new_value,changed_by,changed_at").in("field", ["note", "next_action", "step"]).order("changed_at", { ascending: false }).limit(50),
      admin.from("contacts").select("name,company,role,project,notes,phone,whatsapp").order("name"),
      admin.from("deals").select("*").order("sort"),
      admin.from("deal_steps").select("deal_id,stage,sort,title,status,evidence,closes_with"),
    ]);
    const today = new Date().toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" });
    const todayIso = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
    const todayLong = new Date().toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ` (${todayIso})`;
    const noteText = (notes || []).map((n: any) => `- ${new Date(n.changed_at).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" })} ${n.field} on ${n.item_id ? "item " + n.item_id : n.deal_id ? "deal " + n.deal_id : "-"} by ${n.changed_by}: ${n.new_value}`).join("\n") || "(none)";
    // Directory: live leads always, plus any lead named in the question or in focus
    const [{ data: leads }, { data: lpeople }, { data: ltasks }, { data: gates }] = await Promise.all([
      admin.from("leads").select("id,name,person,side,kind,country,commodity,status,outcome,grade,volume,terms,phone,email,flag,about,priority").limit(3000),
      admin.from("lead_people").select("lead_id,name,title,email"),
      admin.from("lead_tasks").select("task,score,rank,status,gates,lead_ids,not_before"),
      admin.from("gates").select("key,title,status,note"),
    ]);
    const L = leads || [];
    const qlow = String(question || "").toLowerCase();
    const focusLead = String(focus).startsWith("lead:") ? String(focus).slice(5) : (chat && chat.target_type === "lead" ? chat.target_id : "");
    const first = (n: string) => String(n || "").toLowerCase().split(/[ (,]/)[0];
    const hasWord = (w: string) => w.length >= 4 && new RegExp(`\\b${w.replace(/[^a-z0-9]/g, "")}\\b`).test(qlow);
    const peopleLeads = new Set((lpeople || []).filter((p: any) => qlow && hasWord(first(p.name))).map((p: any) => p.lead_id));
    const named = L.filter((l: any) => l.id === focusLead || peopleLeads.has(l.id) || ["replied", "qualified", "deal"].includes(l.status) || (qlow && ([l.name, l.person].some((n: string) => n && n.length > 3 && qlow.includes(n.toLowerCase().split(" (")[0])) || (l.person && hasWord(first(l.person)))))).slice(0, 25);
    const openG = new Set((gates || []).filter((g: any) => g.status === "open").map((g: any) => g.key));
    const ready = (ltasks || []).filter((t: any) => t.status === "open" && !(t.gates || []).some((k: string) => openG.has(k))).sort((a: any, b: any) => b.score - a.score || a.rank - b.rank).slice(0, 8);
    const cnt = (f: (l: any) => boolean) => L.filter(f).length;
    const dir = `# DIRECTORY (${L.length} leads: ${cnt((l) => l.side === "buyer" && l.country !== "South Africa")} foreign buyers, ${cnt((l) => l.side === "buyer" && l.country === "South Africa")} SA buyers, ${cnt((l) => l.side === "supplier")} suppliers; ${cnt((l) => ["new", "ready"].includes(l.status))} not contacted, ${cnt((l) => ["contacted", "replied", "qualified", "deal"].includes(l.status))} contacted, ${cnt((l) => ["replied", "qualified"].includes(l.status))} replied)\n` +
      `Gates: ${(gates || []).map((g: any) => `${g.title}: ${g.status}${g.note ? " (" + g.note + ")" : ""}`).join("; ")}\n` +
      `Buyer-search queue, ready now (score = value x ease): ${ready.map((t: any) => `[${t.score}] ${t.task}`).join(" | ") || "none"}\n` +
      `LEADS in focus:\n${named.map((l: any) => leadText(l, lpeople || [], ltasks || [])).join("\n") || "(none named)"}`;
    const system = SYSTEM(actor, boardText(items || [], deals || [], steps || [], projects || [], today, contacts || []) + "\n\n" + dir, noteText) +
      "\n- Directory rules: never mark a lead contacted or replied yourself; use suggest_lead_update. Hold rule: no offers go out while the mine-confirmation gate is open, and no chrome offers while the ITAC gate is open. Replies to the 28 Reef Trading emails are answered as Chris de Jager, saying Verve Africa is the company name going forward." +
      (appV >= 2 ? APP_RULES(todayLong) : "");
    let userText = mode === "brief" ? "Build today's brief with write_brief. chase_order: items waiting on other people that need a chase today (STALE ones first, then anything that blocks a deal), most urgent first. risks: real contradictions or risks only, each tied to the item, deal or lead id it concerns. drafts: one short friendly WhatsApp per named person in chase_order (from us, plain words, no private target or walk-away limit, no other counterparties' names or terms). No drafts for email lists, groups or ourselves." : question;
    if (mode === "chat" && chat && chat.text) {
      const idKey = chat.target_type === "lead" ? "lead_id" : chat.target_type === "contact" ? "contact_id" : chat.target_type === "deal" ? "deal_id" : "item_id";
      userText = `Below is an exported WhatsApp chat (${chat.count} messages, ${chat.from} to ${chat.to}, people: ${(chat.people || []).join(", ")}) linked to ${chat.target_type} "${chat.target_name}" (${idKey}=${chat.target_id}).\n` +
        `1) Write a summary for the board, under 220 words, plain words, in this order: what this is about; numbers agreed or asked (grade, tonnage, price, basis, payment); who promised what and by when; open questions; red flags (upfront payment, MT103, fake-looking documents, pressure); the next step.\n` +
        `2) Save that summary with add_note on ${idKey}=${chat.target_id}, starting with "WhatsApp chat summary (${chat.count} msgs, ${chat.from}–${chat.to}) – bot, please check:".\n` +
        `3) Then propose only what the chat clearly supports: suggest_lead_update (if a lead), propose_item for things we now wait for, suggest_info_update for deal facts. Never invent.\n\nCHAT:\n${String(chat.text).slice(-60000)}`;
    }
    if (focus) userText = `(Context: focus on id=${focus}.) ` + userText;
    if (!userText.trim()) return json({ answer: "Ask me something about the board.", actions: [] });

    const findDeal = (name: string) => (deals || []).find((d: any) => d.name.toLowerCase() === String(name || "").trim().toLowerCase());
    const messages: any[] = [...history.filter((m: any) => m && m.content).slice(-10), { role: "user", content: userText }];
    const actions: string[] = [];
    const suggestions: any[] = [];
    const app_actions: any[] = [];
    let reload = false;
    let answer = "";
    for (let round = 0; round < 4; round++) {
      const briefMode = mode === "brief";
      const resp = await anthropic(key, { model: MODEL, max_tokens: mode === "chat" ? 2000 : briefMode ? 2500 : 1500, system, tools: briefMode ? [BRIEF_TOOL] : appV >= 2 ? [...TOOLS, APP_TOOL] : TOOLS, ...(briefMode ? { tool_choice: { type: "tool", name: "write_brief" } } : {}), messages });
      if (briefMode) {
        const u = (resp.content || []).find((c: any) => c.type === "tool_use" && c.name === "write_brief");
        if (!u) throw new Error("The bot did not return a brief. Try again.");
        const b = u.input || {};
        const itemIds = new Set((items || []).map((i: any) => i.id));
        const dealIds = new Set((deals || []).map((d: any) => d.id));
        const leadIds = new Set(L.map((l: any) => l.id));
        const ok = (t: string, id: string) => (t === "item" ? itemIds : t === "deal" ? dealIds : t === "lead" ? leadIds : new Set()).has(id);
        const chase_order = (b.chase_order || []).filter((id: string) => itemIds.has(id));
        const risks = (b.risks || []).slice(0, 5).map((r: any) => ok(r.ref_type, r.ref_id) ? r : { text: r.text }).filter((r: any) => r.text);
        let saved = 0;
        for (const d of (b.drafts || []).slice(0, 12)) {
          if (!d.text || !ok(d.ref_type, d.ref_id)) continue;
          if (d.to && String(d.to).trim().toLowerCase() === String(actor).toLowerCase()) continue; // no drafts to ourselves
          const row: any = { field: "draft", new_value: String(d.text).slice(0, 1500), old_value: d.to ? "to " + String(d.to).slice(0, 40) : null, changed_by: `bot (${actor})`, source: "brief" };
          row[d.ref_type + "_id"] = d.ref_id;
          const { error } = await admin.from("events").insert(row);
          if (!error) saved++;
        }
        const brief = { v: 2, summary: String(b.summary || "").slice(0, 400), chase_order, risks, drafts: saved };
        await admin.from("briefs").insert({ actor, text: JSON.stringify(brief) });
        await admin.from("events").insert({ item_id: null, field: "bot", old_value: mode, new_value: "brief", changed_by: actor, source: "bot" });
        return json({ answer: brief.summary, brief, actions: saved ? [`${saved} WhatsApp draft${saved > 1 ? "s" : ""} saved on the items they belong to.`] : [], suggestions: [], reload: true });
      }
      const text = (resp.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
      if (text) answer = answer ? answer + "\n" + text : text;
      const uses = (resp.content || []).filter((c: any) => c.type === "tool_use");
      if (!uses.length || resp.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: resp.content });
      const results: any[] = [];
      for (const u of uses) {
        let out = "ok";
        try {
          if (u.name === "propose_item") {
            const i = u.input;
            const d = i.deal ? findDeal(i.deal) : null;
            const { data, error } = await admin.from("items").insert({
              project: i.project, waiting_on: i.waiting_on, waiting_for: i.waiting_for, blocks: i.blocks || null,
              next_action: i.next_action || null, priority: i.priority || 2, owner: i.owner || actor, state: "Proposed",
              evidence: `Proposed by bot for ${actor}, ${today}`, deal_id: d ? d.id : null,
              ...(i.due && /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? { due_on: i.due } : {}),
            }).select("id").single();
            if (error) throw error;
            actions.push(`Proposed: ${i.waiting_on} — ${i.waiting_for} (${d ? d.name : i.project}). Confirm or drop it on the board.`);
            reload = true; out = `proposed item id=${data.id}${i.deal && !d ? " (deal name not found, left unlinked)" : ""}`;
          } else if (u.name === "add_note") {
            const itemId = u.input.item_id || null, dealId = u.input.deal_id || null, leadId = u.input.lead_id || null, contactId = u.input.contact_id || null;
            if (!itemId && !dealId && !leadId && !contactId) throw new Error("give item_id, deal_id, lead_id or contact_id");
            const { error } = await admin.from("events").insert({ item_id: itemId, deal_id: dealId, lead_id: leadId, contact_id: contactId, field: "note", new_value: u.input.note, changed_by: `bot (${actor})`, source: mode === "chat" ? "whatsapp" : "bot" });
            if (error) throw error;
            actions.push(`Note added: ${u.input.note}`);
            reload = true;
          } else if (u.name === "set_next_action") {
            const { data: old } = await admin.from("items").select("next_action,waiting_for").eq("id", u.input.item_id).maybeSingle();
            if (!old) throw new Error("item not found");
            const { error } = await admin.from("items").update({ next_action: u.input.next_action }).eq("id", u.input.item_id);
            if (error) throw error;
            await admin.from("events").insert({ item_id: u.input.item_id, field: "next_action", old_value: old.next_action, new_value: u.input.next_action, changed_by: `bot (${actor})`, source: "bot" });
            actions.push(`Next step set on "${old.waiting_for}": ${u.input.next_action}`);
            reload = true;
          } else if (u.name === "add_contact") {
            const c = u.input;
            const { data: ex } = await admin.from("contacts").select("id").ilike("name", c.name).maybeSingle();
            const row: any = { name: c.name, created_by: `bot (${actor})` };
            for (const k of ["phone", "whatsapp", "email", "company", "role", "project", "notes"]) if (c[k]) row[k] = c[k];
            const { error } = ex ? await admin.from("contacts").update(row).eq("id", ex.id) : await admin.from("contacts").insert(row);
            if (error) throw error;
            actions.push(`${ex ? "Updated" : "Saved"} contact: ${c.name}`);
            reload = true;
          } else if (u.name === "suggest_lead_update") {
            const l = L.find((x: any) => x.id === u.input.lead_id);
            if (!l) throw new Error("lead not found");
            suggestions.push({ ...u.input, lead_name: l.name });
            actions.push(`Suggested ${u.input.field} for ${l.name} — tap Apply below to accept.`);
            out = "suggestion shown to user with an Apply button";
          } else if (u.name === "suggest_info_update" || u.name === "suggest_project_update") {
            const s = { ...u.input, target: u.input.target || u.input.project };
            suggestions.push(s);
            actions.push(`Suggested ${s.field} change for ${s.target} — tap Apply below to accept.`);
            out = "suggestion shown to user with an Apply button";
          } else if (u.name === "app_action" && appV >= 2) {
            const a = { ...u.input };
            const t = a.target_type, tid = String(a.target_id || "");
            const exists = t === "deal" ? (deals || []).some((d: any) => d.id === tid) : t === "item" ? (items || []).some((x: any) => x.id === tid) : t === "lead" ? L.some((l: any) => l.id === tid) : true;
            if (a.do !== "show" && a.do !== "calculator" && !(a.do === "change" && a.change === "new_deal") && !(a.do === "change" && a.change === "board_post" && !tid) && (!t || !exists)) throw new Error(`${t || "target"} id not found on the board – use an id from the board`);
            if (a.change === "term" && /^(target|limit)\s*=/i.test(String(a.value || ""))) throw new Error("the private target and walk-away numbers are set by the user only");
            app_actions.push(a);
            out = a.do === "change" ? "prepared – the user sees it with a Do it button; nothing is saved until they tap it" : "the app opens it for the user";
          } else out = "unknown tool";
        } catch (e) { out = "error: " + (e as Error).message; }
        results.push({ type: "tool_result", tool_use_id: u.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
    await admin.from("events").insert({ item_id: null, field: "bot", old_value: mode, new_value: userText.slice(0, 300), changed_by: actor, source: "bot" });
    return json({ answer: answer || (app_actions.length ? "" : "(no answer)"), actions, suggestions, reload, ...(appV >= 2 ? { app_actions: app_actions.slice(0, 12) } : {}) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
