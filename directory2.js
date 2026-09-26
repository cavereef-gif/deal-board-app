// Deal Board v11 — Directory: loading, actions, WhatsApp chat import, share target.
window.dirLoad = async function () {
  if (DEMO) { dirDemo(); return; }
  const [a, b, c, d, e, f] = await Promise.all([
    sb.from("leads").select("*").limit(3000),
    sb.from("lead_people").select("*").limit(5000),
    sb.from("lead_tasks").select("*").order("rank"),
    sb.from("gates").select("*").order("sort"),
    sb.from("library").select("*").order("sort"),
    sb.from("events").select("id,lead_id,field,old_value,new_value,changed_by,changed_at").not("lead_id", "is", null).neq("field", "note").order("changed_at", { ascending: false }).limit(600),
  ]);
  if (a.error) { toast("Could not load the directory: " + a.error.message, 6000); return; }
  window._leads = a.data || []; window._lpeople = b.data || []; window._ltasks = c.data || []; window._gates = d.data || []; window._library = e.data || []; window._lhist = f.data || [];
};
function dirDemo() {
  const L = (id, o) => Object.assign({ id, name: "", person: "", side: "buyer", kind: "", market: "Foreign", country: "India", location: "", commodity: "Manganese", status: "new", priority: 2, evidence: "none", phone: "", whatsapp: "", email: "", website: "", channel: "research", grade: "", volume: "", terms: "", source: "Demo", source_date: "", source_url: "", about: "", checked: "", checks_needed: "", flag: "", template: "", personal_line: "", board_ref: "", call_window: "", outcome: "", owner: "Chris", contact_id: null, deal_id: null }, o);
  window._leads = [
    L("l1", { name: "Demo Metals Ltd", kind: "Trader / trading house", country: "UAE", status: "replied", priority: 0, email: "kim@example.com", phone: "012 555 0101", evidence: "verified", outcome: "Kim replied 21 Sep; you asked for volumes and grades.", channel: "email" }),
    L("l2", { name: "Sample Ore Co", kind: "Trader / trading house", country: "USA", status: "ready", priority: 0, email: "buyer@example.com", template: "E", personal_line: "I understand you already bring in South African manganese.", evidence: "found", channel: "email" }),
    L("l3", { name: "Taylor Demo", side: "supplier", kind: "Seller (board post)", market: "SA", country: "South Africa", commodity: "Chrome", phone: "060 555 0103", grade: "Conc 38-44%", terms: "FOT R2,975 / DAP R3,300, escrow only", evidence: "posted", channel: "whatsapp", priority: 1 }),
    L("l4", { name: "Example Chem Works", kind: "End user", commodity: "Chrome", status: "contacted", email: "info@example.com", phone: "+91 40 5550 0104", outcome: "Delivered 20 Sep. No reply yet.", channel: "email", priority: 1 }),
    L("l5", { name: "Blocked Metals JSC", kind: "Sanctioned – do not deal", country: "Russia", commodity: "Chrome", status: "dnd", flag: "Sanctioned – never deal.", priority: 4 }),
    L("l6", { name: "Green Valley Mining", side: "supplier", kind: "Mine + wash plant", market: "SA", country: "South Africa", commodity: "Chrome", phone: "014 555 0105", email: "office@example.com", evidence: "verified", channel: "call", flag: "Old mobile 083 555 0106 is outdated." }),
  ];
  window._lpeople = [{ id: "p1", lead_id: "l1", name: "Kim Example", title: "Buyer desk, Centurion", email: "kim@example.com", phone: "012 555 0101", whatsapp: "", email_note: "", note: "Replied 21 Sep", priority: 0, sort: 1 }];
  window._ltasks = [
    { id: "t1", rank: 1, task: "Check ITAC chrome export permit status", value: 3, ease: 3, score: 9, kind: "GATE", gates: [], lead_ids: [], status: "open", not_before: null },
    { id: "t2", rank: 1.5, task: "Kim: chase volumes and grades if nothing by 29 Sep", value: 3, ease: 3, score: 9, kind: "BUYER", gates: [], lead_ids: ["l1"], status: "open", not_before: null },
    { id: "t3", rank: 4, task: "Call Taylor Demo 060 555 0103", value: 3, ease: 2, score: 6, kind: "SUPPLY", gates: [], lead_ids: ["l3"], status: "open", not_before: null },
    { id: "t4", rank: 24, task: "Send Verve email to Jordan Sample", value: 3, ease: 3, score: 9, kind: "SEND-Mn", gates: ["mine"], lead_ids: ["l2"], status: "open", not_before: null },
    // a follow-up: no reply yet, so it stays open and comes back in two days
    { id: "t5", rank: 6, task: "Example Chem Works: check they got the offer email (sent 20 Sep)", value: 2, ease: 3, score: 6, kind: "BUYER", gates: [], lead_ids: ["l4"], status: "open", not_before: saDayPlus(2), outcome: "No reply yet (checked 26 Sep)", owner: "Chris" },
  ];
  window._gates = [{ key: "mine", title: "Mine confirmation in writing", unblocks: "Every send", status: "open", note: "Verbal only", major: true, sort: 1 }, { key: "itac", title: "ITAC chrome export permit status known", unblocks: "All chrome sends", status: "open", note: "", major: true, sort: 2 }];
  window._library = [
    { id: "s1", kind: "script", title: "Buyer opener", body: "Good day, this is Chris from Verve Africa in Durban. Are you still buying?", meta: { code: "opener-buyer", use: "whatsapp" }, sort: 1 },
    { id: "s2", kind: "script", title: "Seller opener", body: "Good day, Chris from Verve Africa in Durban. Is the material still available?", meta: { code: "opener-seller", use: "whatsapp" }, sort: 2 },
    { id: "s3", kind: "script", title: "Template E", body: "Dear [Name],\n\n[PERSONAL LINE]\n\nKind regards,\nChris", meta: { code: "E", subject: "A team you can rely on in South Africa" }, sort: 3 },
    { id: "k1", kind: "kit", title: "How a mineral deal runs – the SA way", body: "The stages in the app's deal kit, with rough timings. Each step in a deal shows what good looks like, who does it and the document that closes it.\n\n1. Enquiry (day 0–3): write down the buyer's requirement, check it makes physical sense, name the principals, NCNDA before names are shared.\n2. Protect our commission (before names): commission agreement signed by the party who pays; principals acknowledge us.\n3. KYC checks (day 1–10): company registration, mining right or permit, chain of custody, tax PIN, bank letter, buyer's proof of funds, adverse media.\n4. Offers (day 3–10): buyer's LOI or ICPO, seller's FCO, both on the same terms.\n5. Proof of product (day 5–15): site visit, first assay by the buyer's inspector with sealed splits, stock survey and ownership letter.\n\nTypical waits: KYC 2–10 working days; LOI to FCO 1–5 days; lab results about 48 h; SPA 1–3 weeks; escrow 1–3 days.", meta: {}, sort: 1 },
    { id: "k2", kind: "kit", title: "Payment security – what counts and what does not", body: "Counts:\n- Local: escrow. The buyer deposits; funds are held by a registered escrow company. The seller gets a letter of comfort before loading. Fees are a small percentage, paid by buyer, seller, agent or split. Our commission can be a split in the same transaction.\n- Local alternative: pay before each batch – 'test, pay, load'.\n- Export: irrevocable letter of credit, confirmed by an SA bank, checked against the contract before loading.\n\nDoes not count:\n- Copies of payment messages (they only prove a payment already sent).\n- Screenshots or unaddressed bank letters as proof of funds.\n- Any up-front fee paid to someone in the chain.", meta: {}, sort: 2 },
    { id: "r1", kind: "rule", title: "Hold rule", body: "Nothing goes out until (1) the mine confirmation is in writing and (2) for chrome, the export-permit position is checked. Manganese messages are not affected by the permit rule.", meta: {}, sort: 1 },
    { id: "c1", kind: "country", title: "India", body: "The market that publishes emails and answers.", meta: { focus: "Manganese", companies: "27", key: "Company A, Company B" }, sort: 1 },
  ];
  window._lhist = [];
}

function dirRender(keepFocus) {
  const el = document.activeElement, isQ = el && el.id === "dQ", pos = isQ ? el.selectionStart : 0;
  render();
  if (isQ || keepFocus) { const q = $("dQ"); if (q) { q.focus({ preventScroll: true }); try { q.setSelectionRange(pos, pos); } catch (e) {} } }
}
let dqT;
$("list").addEventListener("input", e => {
  if (e.target.id !== "dQ") return;
  clearTimeout(dqT); dqT = setTimeout(() => { dQ = e.target.value; dLimit = 40; dirRender(true); }, 250);
});
$("list").addEventListener("change", async e => {
  if (e.target.id === "dCountry") { dCountry = e.target.value; dLimit = 40; render(); return; }
  const sl = e.target.closest("select[data-dstsel]");
  if (sl && sl.value) { const b = document.createElement("button"); b.dataset.dst = sl.dataset.dstsel; b.dataset.v = sl.value; sl.closest(".acts0").appendChild(b); b.click(); b.remove(); return; }
  const ld = e.target.closest("select[data-dleaddeal]");
  if (ld) { await leadSave(ld.dataset.dleaddeal, { deal_id: ld.value || "" }, ld.value ? "Linked to the deal." : "Removed from the deal."); }
});
async function rpc(name, args, okMsg) {
  if (DEMO) { toast("Demo mode — nothing saved"); return false; }
  const { error } = await sb.rpc(name, args);
  if (error) { toast("Could not save: " + error.message, 6000); return false; }
  if (okMsg) toast(okMsg);
  load(); return true;
}
const leadSave = (id, p, msg) => rpc("save_lead", { p_id: id || null, p }, msg || "Saved.");

$("list").addEventListener("click", async e => {
  const t = e.target.closest("button,[data-dopen]"); if (!t) return;
  const ds = t.dataset;
  if (ds.dseg) { dSeg = ds.dseg; dStat = "any"; dLimit = 40; dCountry = ""; try { localStorage.setItem("dSeg", dSeg); } catch (x) {} render(); return; }
  if (ds.dstat) { dStat = ds.dstat; dLimit = 40; render(); return; }
  if (ds.dmore) { dLimit += 40; render(); return; }
  if (ds.dopen) { if (dOpen !== ds.dopen && window.navPush) navPush(); dOpen = dOpen === ds.dopen ? null : ds.dopen; dForm = null; dEditLead = null; dPersonForm = null; render(); const el = document.getElementById("lead-" + ds.dopen); if (el && dOpen) el.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
  if (ds.dgo) { const l = leadById(ds.dgo); if (!l) return; if (window.navPush) navPush(); view = "leads"; try { localStorage.setItem("view", view); } catch (x) {} dSeg = "all"; dStat = "any"; dCountry = ""; dQ = l.name; dOpen = l.id; render(); const el = document.getElementById("lead-" + l.id); if (el) el.scrollIntoView({ block: "start" }); return; }
  if (ds.dnew) { dNewLead = !dNewLead; render(); return; }
  if (ds.dedit) { dEditLead = dEditLead === ds.dedit ? null : ds.dedit; render(); return; }
  if ("dsave" in ds && t.matches("[data-dsave]")) {
    const box = t.closest(".sec-b,.step-p"); const v = k => { const x = box.querySelector(".lf-" + k); return x ? x.value.trim() : undefined; };
    const p = {}; for (const k of ["name", "person", "side", "priority", "country", "commodity", "phone", "email", "grade", "volume", "terms", "source", "about"]) { const x = v(k); if (x !== undefined) p[k] = x; }
    if (!p.name) { $("lfMsg").textContent = "A name is needed."; return; }
    if (p.country) p.market = p.country.toLowerCase() === "south africa" ? "SA" : "Foreign";
    if (p.phone && !p.whatsapp && toWa(p.phone) && looksMobile(toWa(p.phone))) p.whatsapp = toWa(p.phone);
    t.disabled = true;
    const ok = await leadSave(ds.dsave || null, p, ds.dsave ? "Lead saved." : "Lead added.");
    if (ok) { dNewLead = false; dEditLead = null; } else t.disabled = false; return;
  }
  if (ds.dwa) { const l = leadById(ds.dwa); location.href = `https://wa.me/${waOf(l)}?text=` + encodeURIComponent(waText(l)); return; }
  if (ds.dnowa) { toast("No mobile number saved for WhatsApp. Tap Edit and add one (or Pick from phone)."); dEditLead = ds.dnowa; render(); return; }
  if (ds.demail) { const l = leadById(ds.demail), m = mailOf(l); location.href = `mailto:${emailOf(l)}?subject=${encodeURIComponent(m.subj)}&body=${encodeURIComponent(m.body.slice(0, 6000))}`; return; }
  if (ds.demailme) { const l = leadById(ds.demailme); emailMe("Lead: " + l.name, leadSummary(l)); return; }
  if (ds.demailmeLib) { const x = (window._library || []).find(y => y.id === ds.demailmeLib); if (x) emailMe(x.title, x.body); return; }
  if (ds.dcopy) { const x = (window._library || []).find(y => y.id === ds.dcopy); if (!x) return; try { await navigator.clipboard.writeText(x.body); toast("Copied."); } catch (er) { toast("Copy not allowed here – long-press the text instead."); } return; }
  if (ds.dbot) { const l = leadById(ds.dbot); askBot(`About the lead "${l.name}": where it stands, what we know, what is missing, the next step, and draft the first message (WhatsApp or email) in plain words.`, "ask", "lead:" + l.id); return; }
  if (ds.dst) {
    const s = ds.v, l = leadById(ds.dst);
    if (["contacted", "replied", "qualified", "bounced"].includes(s)) { dForm = { type: "status", id: l.id, status: s }; render(); const o = $("stOut"); if (o) o.focus(); return; }
    if (s === "dnd" && !confirm(`Mark ${l.name} as Do not deal?`)) return;
    await rpc("lead_status", { p_id: l.id, p_status: s, p_via: null, p_outcome: null }, "Status: " + ST[s][0]); return;
  }
  if (ds.dstcancel) { dForm = null; render(); return; }
  if (ds.dstsave) { const f = dForm; if (!f) return; t.disabled = true; const ok = await rpc("lead_status", { p_id: f.id, p_status: f.status, p_via: $("stVia").value, p_outcome: $("stOut").value.trim() || null }, "Status: " + ST[f.status][0]); if (ok) dForm = null; else t.disabled = false; return; }
  if ("dtasknew" in ds && t.matches("[data-dtasknew]")) { const lead = ds.dtasknew || null; dForm = dForm && dForm.type === "task" && dForm.lead === lead ? null : { type: "task", lead }; render(); const x = $("ntTask"); if (x) x.focus(); return; }
  if ("dtasksave" in ds && t.matches("[data-dtasksave]")) {
    const task = $("ntTask").value.trim(); if (!task) { $("ntTask").focus(); return; }
    const g = $("ntGate").value;
    const ok = await rpc("save_task", { p_id: null, p: { task, value: $("ntVal").value, ease: $("ntEase").value, gates: g ? g.split(",") : [], lead_ids: ds.dtasksave ? [ds.dtasksave] : [], rank: 50, owner: me || "Chris" } }, "Step added.");
    if (ok) dForm = null; return;
  }
  if ("dtaskdone" in ds && t.matches("[data-dtaskdone]")) { dTaskDone = ds.dtaskdone || null; render(); const x = $("tOut"); if (x) x.focus(); return; }
  if (ds.dtaskact) {
    const out = $("tOut") ? $("tOut").value.trim() : "";
    if (ds.v === "block" && !out) { toast("Write why it is blocked first."); $("tOut").focus(); return; }
    if (ds.v === "followup") {
      // no reply yet: the step stays open and comes back on the follow-up date (never marked done)
      const fd = ($("tFu") && $("tFu").value) || saDayPlus(3), when = dayName(new Date(fd + "T08:00:00+02:00"));
      if (fd < saDayPlus(1)) { toast("Pick a follow-up date from tomorrow on."); $("tFu").focus(); return; }
      const note = out || "No reply yet";
      if (DEMO) { const tk = (window._ltasks || []).find(x => x.id === ds.dtaskact); if (tk) Object.assign(tk, { status: "open", not_before: fd, outcome: note, done_by: null, done_at: null, blocked_note: "" }); dTaskDone = null; toast(`Follow-up set for ${when} – the step stays open (demo – not saved).`); render(); return; }
      const ok = await rpc("task_action", { p_id: ds.dtaskact, p_action: "followup", p_value: fd + "|" + note }, `Follow-up set for ${when} – the step stays open.`);
      if (ok) dTaskDone = null; return;
    }
    if (DEMO) { const tk = (window._ltasks || []).find(x => x.id === ds.dtaskact); if (tk) { tk.status = ds.v === "done" ? "done" : ds.v === "block" ? "blocked" : ds.v === "drop" ? "dropped" : "open"; tk.outcome = out; tk.done_by = me; tk.done_at = new Date().toISOString(); } dTaskDone = null; render(); return; }
    const ok = await rpc("task_action", { p_id: ds.dtaskact, p_action: ds.v, p_value: out || null }, ds.v === "done" ? "Done – next one moves up." : "Saved.");
    if (ok) dTaskDone = null; return;
  }
  if (ds.dgate) {
    const g = (window._gates || []).find(x => x.key === ds.dgate); if (!g) return;
    const to = g.status === "open" ? "cleared" : "open";
    const note = prompt(to === "cleared" ? `Clear the gate "${g.title}"? Write the proof in one line (e.g. "Mine letter in Files, 26 Sep").` : `Reopen "${g.title}"? Why?`);
    if (note === null) return;
    if (DEMO) { g.status = to; g.note = note || g.note; render(); return; }
    await rpc("set_gate", { p_key: g.key, p_status: to, p_note: note || null }, to === "cleared" ? "Gate cleared – its steps are now in the queue." : "Gate reopened."); return;
  }
  if ("dpnew" in ds && t.matches("[data-dpnew]")) { dPersonForm = ds.dpnew && !(dPersonForm && dPersonForm.lead === ds.dpnew && !dPersonForm.p) ? { lead: ds.dpnew, p: null } : null; render(); return; }
  if (ds.dpedit) { const p = (window._lpeople || []).find(x => x.id === ds.dpedit); dPersonForm = { lead: p.lead_id, p }; render(); return; }
  if ("dpsave" in ds && t.matches("[data-dpsave]")) {
    const box = t.closest(".step-p"); const p = {}; for (const k of ["name", "title", "email", "phone", "note"]) p[k] = box.querySelector(".pf-" + k).value.trim();
    if (!p.name) { toast("A name is needed."); return; }
    if (p.phone && looksMobile(toWa(p.phone))) p.whatsapp = toWa(p.phone);
    const ok = await rpc("save_person", { p_id: ds.dpsave || null, p_lead: ds.lead, p }, "Person saved.");
    if (ok) dPersonForm = null; return;
  }
  if (ds.dprm) { const p = (window._lpeople || []).find(x => x.id === ds.dprm); if (!p || !confirm(`Remove ${p.name} from this company? (It is logged in the history.)`)) return; const ok = await rpc("remove_person", { p_id: p.id }, "Removed."); if (ok) dPersonForm = null; return; }
  if (ds.dpwa) { const p = (window._lpeople || []).find(x => x.id === ds.dpwa), l = leadById(p.lead_id); location.href = `https://wa.me/${p.whatsapp || toWa(p.phone)}?text=` + encodeURIComponent(waText(l).replace(/^Good day/, "Good day " + p.name.split(" ")[0])); return; }
  if (ds.dpmail) { const p = (window._lpeople || []).find(x => x.id === ds.dpmail), l = leadById(p.lead_id), m = mailOf(l, p.name.split(" ")[0] === "Attn" ? "" : "Mr/Ms " + p.name.split(" ").slice(-1)[0]); location.href = `mailto:${p.email}?subject=${encodeURIComponent(m.subj)}&body=${encodeURIComponent(m.body.slice(0, 6000))}`; return; }
  if (ds.dpick) {
    try {
      const [c] = await navigator.contacts.select(["name", "tel", "email"], { multiple: false }); if (!c) return;
      const box = t.closest(".step-p,.sec-b"), pre = ds.dpick;
      const set = (k, v) => { const x = box.querySelector(`.${pre}-${k}`); if (x && v && !x.value) x.value = v; };
      set(pre === "pf" ? "name" : "person", (c.name || [])[0]); const ph = box.querySelector(`.${pre}-phone`); if (ph && (c.tel || [])[0]) ph.value = c.tel[0]; set("email", (c.email || [])[0]);
    } catch (er) { toast("Could not open your phone contacts."); }
    return;
  }
  if (ds.dchat) { startChatImport(ds.dchat); return; }
});

// ---------- WhatsApp chat import ----------
let pendingChat = null;
function chatTargetName(target) {
  const [type, ...rest] = target.split(":"); const id = rest.join(":");
  return type === "lead" ? (leadById(id) || {}).name : type === "contact" ? ((window._contacts || []).find(c => c.id === id) || {}).name : type === "deal" ? (dealById(id) || {}).name : ((window._items || []).find(i => i.id === id) || {}).waiting_for;
}
function startChatImport(target) {
  pendingChat = target;
  if (window._shared) { const s = window._shared; window._shared = null; handleChatText(s.text, s.name); return; }
  $("csFor").textContent = "For: " + (chatTargetName(target) || "this record");
  $("csText").value = "";
  $("csClip").classList.toggle("hidden", !(navigator.clipboard && navigator.clipboard.readText));
  $("chatSheet").classList.remove("hidden");
}
window.startChatImport = startChatImport;
const closeChatSheet = () => $("chatSheet").classList.add("hidden");
$("csClose").onclick = () => { closeChatSheet(); pendingChat = null; };
$("chatSheet").addEventListener("click", e => { if (e.target.id === "chatSheet") { closeChatSheet(); pendingChat = null; } });
$("csFile").onclick = () => { $("chatInput").value = ""; $("chatInput").click(); };
$("csClip").onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t) { $("csText").value = t; } else toast("The clipboard is empty – copy the messages in WhatsApp first."); } catch (er) { toast("Paste was blocked – long-press the box and tap Paste instead.", 5000); $("csText").focus(); } };
$("csPaste").onclick = () => {
  const t = $("csText").value.trim(); if (!t) { toast("Paste the messages into the box first."); $("csText").focus(); return; }
  closeChatSheet(); handleChatText(t, `whatsapp-paste-${todaySA()}.txt`, true);
};
async function readChatFile(f) {
  if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
    if (!window.JSZip) await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const z = await JSZip.loadAsync(f); const txt = Object.values(z.files).find(x => /\.txt$/i.test(x.name));
    if (!txt) throw new Error("No chat text inside that zip.");
    return await txt.async("string");
  }
  return await f.text();
}
$("chatInput").addEventListener("change", async () => {
  const f = $("chatInput").files && $("chatInput").files[0]; if (!f || !pendingChat) return;
  closeChatSheet();
  try { handleChatText(await readChatFile(f), f.name); } catch (er) { toast("Could not read that file: " + (er.message || er), 6000); }
});
function parseChat(text) {
  // Exports ("25/09/2026, 14:03 - Name: ", "[2026/09/25, 14:03:22] Name: ") and copied messages ("[25/09, 14:03] Name: ")
  const re = /^\[?(\d{1,4}[\/.-]\d{1,2}(?:[\/.-]\d{1,4})?),? (\d{1,2}[:.]\d{2})(?:[:.]\d{2})?(?:\s?[APap]\.?\s?[Mm]\.?)?\]?\s?[-–]?\s?([^:]{1,60}): /;
  const lines = text.replace(/‎/g, "").split(/\r?\n/); let n = 0, first = "", last = ""; const who = new Set();
  for (const ln of lines) { const m = ln.match(re); if (m) { n++; if (!first) first = m[1]; last = m[1]; who.add(m[3].trim()); } }
  return { n, first, last, who: [...who].slice(0, 6) };
}
async function handleChatText(text, fname, pasted) {
  if (!pendingChat) return;
  const [type, ...rest] = pendingChat.split(":"); const id = rest.join(":");
  const name = chatTargetName(pendingChat); pendingChat = null;
  let info = parseChat(text || "");
  if (!info.n && !pasted) { toast("That does not look like a WhatsApp export. In WhatsApp: open the chat › ⋮ › More › Export chat › Without media.", 7000); return; }
  if (!info.n) info = { n: text.split(/\r?\n/).filter(x => x.trim()).length, first: "", last: "", who: [] };
  const what = info.first ? `${info.n} messages, ${info.first} to ${info.last}${info.who.length ? ", between " + info.who.join(", ") : ""}` : `pasted text, ${info.n} lines`;
  if (!confirm(`WhatsApp chat: ${what}.\n\nSave it to Files on "${name}" and ask the bot for a summary (facts, numbers, promises, open questions)? The text goes to the bot (Anthropic) to summarise.`)) return;
  if (DEMO) { toast("Demo mode — nothing saved"); return; }
  toast("Saving the chat…", 0);
  const blob = new Blob([text], { type: "text/plain" });
  const path = `${type}/${id}/${Date.now()}-${(fname || "whatsapp-chat.txt").replace(/[^\w.\-]+/g, "_").slice(-70)}`;
  const up = await sb.storage.from("files").upload(path, blob, { contentType: "text/plain", upsert: false });
  if (!up.error) await sb.from("attachments").insert({ target_type: type, target_id: String(id), path, name: fname || "WhatsApp chat.txt", size: blob.size, mime: "text/plain" });
  toast("Summarising – this takes about 20 seconds…", 0);
  if (view !== "bot" && window.navPush) navPush(); view = "bot"; try { localStorage.setItem("view", view); } catch (x) {}
  chat.push({ role: "sys", text: `WhatsApp chat on ${name}: ${info.n} messages (${info.first}–${info.last}). Saved to Files. Summarising…` }); botBusy = true; render();
  try {
    const { data, error } = await sb.functions.invoke("ask", { body: { mode: "chat", question: "", focus: `${type}:${id}`, chat: { text: text.slice(-60000), count: info.n, from: info.first, to: info.last, people: info.who, target_type: type, target_id: id, target_name: name } } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (x) {} throw new Error(m); }
    chat.push({ role: "assistant", text: data.answer || "(no summary)" });
    if (data.actions && data.actions.length) chat.push({ role: "sys", text: data.actions.join("\n") });
    for (const s of (data.suggestions || [])) chat.push({ role: "sugg", s, text: "" });
  } catch (er) { chat.push({ role: "sys", text: "Bot error: " + (er.message || er) }); }
  botBusy = false; $("toast").classList.add("hidden"); render(); load();
}

// ---------- Android share target: WhatsApp › Export chat › Deal Board ----------
async function readSharedInbox() {
  if (!new URLSearchParams(location.search).has("shared") || !("caches" in window)) return;
  try {
    const c = await caches.open("share-inbox"); const meta = await c.match("./shared-meta"); if (!meta) return;
    const m = await meta.json(); let text = "", name = (m.names || [])[0] || "WhatsApp chat.txt";
    const r = await c.match("./shared-file-0");
    if (r) { const b = await r.blob(); text = /zip/.test(b.type) || /\.zip$/i.test(name) ? await readChatFile(new File([b], name, { type: "application/zip" })) : await b.text(); }
    else text = m.text || "";
    await caches.delete("share-inbox");
    history.replaceState(null, "", location.pathname);
    if (!text) return;
    window._shared = { text, name };
    view = "leads"; try { localStorage.setItem("view", view); } catch (x) {}
    toast("Chat received. Open the person (Directory or People) and tap the green import icon.", 8000);
    render();
  } catch (e) { toast("Could not read the shared chat: " + e.message, 6000); }
}
window.readSharedInbox = readSharedInbox;
