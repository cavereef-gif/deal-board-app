// Deal Board v17 prototype – step 2: Claude reads for you.
// + › "Read a photo or PDF" (handwritten notes, a business card, a whiteboard, a contract, an assay, an invoice),
// + › "Decode a WhatsApp quote", deal page › Numbers › "Read terms from a document", and Voice note › "Make tasks from it".
// The edge function `read` returns suggestions only. A review sheet shows every line with a tick box; the person fixes
// words, unticks what is wrong and taps Save. Nothing is saved without that tap.

let rdKind = "photo", rdWhat = "notes", rdFile = null, rdBlob = null, rdResult = null, rdCtx = null;
const RD_MAX_PDF = 6 * 1024 * 1024;

// ---------- the "what do you want read" sheet ----------
function rdAboutOptions(sel) {
  return `<option value="">Nothing in particular</option>` + liveDeals().map(d => `<option value="deal:${d.id}"${sel === "deal:" + d.id ? " selected" : ""}>Deal: ${esc(d.name)}</option>`).join("") +
    (window._contacts || []).map(c => `<option value="contact:${c.id}"${sel === "contact:" + c.id ? " selected" : ""}>Contact: ${esc(c.name)}</option>`).join("");
}
function rdPaint() {
  const isQuote = rdKind === "quote";
  $("rdTitle").textContent = isQuote ? "Decode a WhatsApp quote" : "Read a photo or PDF";
  $("rdFileBox").classList.toggle("hidden", isQuote);
  $("rdTextBox").classList.toggle("hidden", !isQuote);
  $("rdKeepBox").classList.toggle("hidden", isQuote);
  document.querySelectorAll("#rdSheet [data-rdwhat]").forEach(b => b.classList.toggle("on", b.dataset.rdwhat === rdWhat));
  $("rdHint").textContent = isQuote ? "Long-press the message in WhatsApp › Copy, then tap Paste below. You get a tidy card and what is missing (VAT, payment, validity …)."
    : rdWhat === "doc" ? "A contract, offer, assay, invoice or bank letter. The deal terms come out, each with the words they came from."
    : "Handwritten notes, a whiteboard, a business card or a screenshot. Tasks, contacts and notes come out.";
  $("rdGo").innerHTML = ic("bot") + (isQuote ? "Decode it" : "Read it");
}
function openReader(opts) {
  opts = opts || {};
  rdKind = opts.kind === "quote" ? "quote" : "photo"; rdWhat = opts.what || "notes"; rdFile = null; rdBlob = null;
  $("rdText").value = opts.text || ""; $("rdMsg").textContent = ""; $("rdPreview").innerHTML = "";
  $("rdAbout").innerHTML = rdAboutOptions(opts.about || ""); $("rdKeep").checked = true;
  rdPaint(); $("rdSheet").classList.remove("hidden");
}
window.openReader = openReader;
$("rdClose").onclick = () => $("rdSheet").classList.add("hidden");
$("rdSheet").addEventListener("click", e => {
  if (e.target.id === "rdSheet") { $("rdSheet").classList.add("hidden"); return; }
  const w = e.target.closest("[data-rdwhat]"); if (w) { rdWhat = w.dataset.rdwhat; rdPaint(); return; }
});
$("rdCam").onclick = () => { $("rdCamInput").value = ""; $("rdCamInput").click(); };
$("rdPick").onclick = () => { $("rdFileInput").value = ""; $("rdFileInput").click(); };
["rdCamInput", "rdFileInput"].forEach(id => $(id).addEventListener("change", async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  $("rdMsg").textContent = "";
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
    if (f.size > RD_MAX_PDF) { $("rdMsg").textContent = "That PDF is over 6 MB. Send only the pages that matter, or take photos of them."; return; }
    rdFile = f; rdBlob = f; if (rdWhat === "notes") rdWhat = "doc"; rdPaint();
    $("rdPreview").innerHTML = `<div class="rdfile">${ic("terms")}<span>${esc(f.name)} · ${fmtSize(f.size)}</span></div>`; return;
  }
  try { rdBlob = await shrinkImage(f, 1568); rdFile = f; }
  catch (er) { $("rdMsg").textContent = "Couldn't open that picture. Use a normal photo (JPG or PNG)."; return; }
  $("rdPreview").innerHTML = `<img class="rdimg" alt="The photo to read" src="${URL.createObjectURL(rdBlob)}">`;
}));
// Make photos small enough to send quickly (Claude reads up to about 1568 pixels on the long side anyway)
function shrinkImage(file, max) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? ok(b) : bad(new Error("no image")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("not an image")); };
    img.src = url;
  });
}
const blobB64 = b => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = bad; r.readAsDataURL(b); });
$("rdClip").onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t) $("rdText").value = t; else toast("Nothing copied yet."); } catch (e) { toast("Long-press the box and tap Paste instead.", 5000); $("rdText").focus(); } };
$("rdGo").onclick = async () => {
  const about = $("rdAbout").value;
  if (rdKind === "quote") {
    const t = $("rdText").value.trim(); if (!t) { $("rdMsg").textContent = "Paste the WhatsApp message first."; return; }
    return runReader({ kind: "quote", text: t, about }, $("rdMsg"), () => $("rdSheet").classList.add("hidden"));
  }
  if (!rdBlob) { $("rdMsg").textContent = "Take a photo or choose a file first."; return; }
  rdCtx = { keep: $("rdKeep").checked, blob: rdBlob, name: rdFile ? rdFile.name : "photo.jpg" };
  const isPdf = rdBlob.type === "application/pdf";
  const file = { data: await blobB64(rdBlob), media_type: isPdf ? "application/pdf" : "image/jpeg", name: rdCtx.name };
  return runReader({ kind: rdWhat === "doc" || isPdf ? "document" : "photo", file, about }, $("rdMsg"), () => $("rdSheet").classList.add("hidden"), rdCtx);
};

// ---------- call the reader ----------
async function runReader(req, msgEl, onDone, ctx) {
  const btns = [$("rdGo"), $("vnTasks")].filter(Boolean);
  if (msgEl) msgEl.textContent = req.kind === "photo" || req.kind === "document" ? "Reading… this can take up to a minute." : "Reading…";
  btns.forEach(b => b.disabled = true);
  let data, error;
  try {
    if (DEMO) { await new Promise(r => setTimeout(r, 300)); data = demoRead(req); }
    else ({ data, error } = await sb.functions.invoke("read", { body: req }));
    if (error) { let m = error.message || String(error); try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (x) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
  } catch (er) { btns.forEach(b => b.disabled = false); if (msgEl) msgEl.textContent = "Couldn't read it: " + er.message; return; }
  btns.forEach(b => b.disabled = false);
  if (msgEl) msgEl.textContent = "";
  if (onDone) onDone();
  rdResult = { ...data, _req: { kind: req.kind, about: req.about || "", text: req.text || "" }, _ctx: ctx || null };
  openReview();
}
window.runReader = runReader;

// ---------- the review sheet: every line ticked or not, words can be fixed ----------
const rvWho = o => ["Chris", "Annemarie"].map(n => `<option${o === n ? " selected" : ""}>${n}</option>`).join("");
function quoteText(q) {
  const L = [];
  const add = (k, v) => { if (v && String(v).trim()) L.push(`${k}: ${v}`); };
  add("From", q.from_who); add("Product", q.product); add("Grade", q.grade); add("Quantity", q.quantity);
  add("Price", [q.price, q.unit, q.vat ? "(VAT " + q.vat + ")" : ""].filter(Boolean).join(" ")); add("Basis", [q.basis, q.place].filter(Boolean).join(" "));
  add("Transport", q.transport_from || q.transport_to ? `${q.transport_from || "?"} → ${q.transport_to || "?"}` : ""); add("Payment", q.payment); add("Valid", q.validity); add("Other", q.other);
  if ((q.missing || []).length) L.push("Not stated: " + q.missing.join("; "));
  return L.join("\n");
}
function openReview() {
  const r = rdResult, about = r._req.about;
  const aboutDeal = about.startsWith("deal:") ? about.slice(5) : "";
  const dealOpts = sel => `<option value="">No deal</option>` + liveDeals().map(d => `<option value="${d.id}"${sel === d.id ? " selected" : ""}>${esc(d.name)}</option>`).join("");
  let h = `<div class="rvsum">${esc(r.summary || "")}</div>`;
  const q = r.quote;
  if (q && q.is_quote) {
    const kv = (k, v) => v && String(v).trim() ? `<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>` : "";
    h += `<div class="lbl">The quote, tidied</div><div class="rvq">${kv(q.side === "request" ? "Asked by" : "From", q.from_who)}${kv("Product", q.product)}${kv("Grade", q.grade)}${kv("Quantity", q.quantity)}${kv("Price", [q.price, q.unit].filter(Boolean).join(" "))}${kv("VAT", q.vat)}${kv("Basis", [q.basis, q.place].filter(Boolean).join(" "))}${kv("Transport", q.transport_from || q.transport_to ? `${q.transport_from || "?"} → ${q.transport_to || "?"}` : "")}${kv("Payment", q.payment)}${kv("Valid", q.validity)}${kv("Other", q.other)}</div>`;
    if ((q.missing || []).length) h += `<div class="rvmiss"><div class="lbl" style="margin-top:10px">Not stated – ask before you rely on it</div><ul class="ez-ul">${q.missing.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>`;
    h += `<label class="rvrow"><span class="rvtick"><input type="checkbox" data-rv="quote" checked><span class="bx" aria-hidden="true"></span></span><span class="rv-b"><span class="rv-t">Save the tidy quote as a note</span><span class="rv-s">${about ? "On " + esc(rvTargetName(about)) : "On the notice board"}</span></span></label>`;
  }
  const T = r.tasks || [];
  if (T.length) h += `<div class="lbl">Tasks · ${T.length}</div>` + T.map((t, i) => `<div class="rvrow"><label class="rvtick"><input type="checkbox" data-rv="task:${i}" checked aria-label="Save this task"><span class="bx" aria-hidden="true"></span></label><span class="rv-b">
      <textarea class="rv-in rv-ta" rows="2" data-rvf="task:${i}:what" aria-label="Task">${esc(t.what)}</textarea>
      <span class="rv-s">${t.waiting_on && t.waiting_on !== "Me" ? "Waiting on " + esc(t.waiting_on) : "Our job"}${t.why ? " · “" + esc(t.why) + "”" : ""}</span>
      <span class="rv-2"><label><span>Who</span><select data-rvf="task:${i}:owner">${rvWho(t.owner || me || "Chris")}</select></label><label><span>Due</span><input type="date" data-rvf="task:${i}:due" value="${esc(/^\d{4}-\d\d-\d\d$/.test(t.due || "") ? t.due : "")}"></label></span>
      <label class="rv-d"><span>Deal</span><select data-rvf="task:${i}:deal">${dealOpts(t.deal_id || aboutDeal)}</select></label></span></div>`).join("");
  const C = r.contacts || [];
  if (C.length) h += `<div class="lbl">Contacts · ${C.length}</div>` + C.map((c, i) => `<div class="rvrow"><label class="rvtick"><input type="checkbox" data-rv="contact:${i}" checked aria-label="Save this contact"><span class="bx" aria-hidden="true"></span></label><span class="rv-b">
      ${["name", "company", "role", "phone", "email"].map(k => `<label class="rv-f"><span>${{ name: "Name", company: "Company", role: "Role", phone: "Phone", email: "Email" }[k]}</span><input class="rv-in" data-rvf="contact:${i}:${k}" value="${esc(c[k] || "")}"${k === "phone" ? ' type="tel"' : k === "email" ? ' type="email"' : ""}></label>`).join("")}
      ${c.notes ? `<span class="rv-s">${esc(c.notes)}</span>` : ""}${(window._contacts || []).some(x => (x.name || "").toLowerCase() === (c.name || "").toLowerCase()) ? `<span class="rv-s">Already saved under this name – untick unless it is new.</span>` : ""}</span></div>`).join("");
  const N = r.notes || [];
  if (N.length) h += `<div class="lbl">Notes · ${N.length}</div>` + N.map((n, i) => `<div class="rvrow"><label class="rvtick"><input type="checkbox" data-rv="note:${i}" checked aria-label="Save this note"><span class="bx" aria-hidden="true"></span></label><span class="rv-b">
      <textarea class="rv-in rv-ta" rows="2" data-rvf="note:${i}:text" aria-label="Note">${esc(n.text)}</textarea><span class="rv-s">On ${esc(n.deal_id ? "the deal " + ((dealById(n.deal_id) || {}).name || "") : n.contact_id ? ((window._contacts || []).find(c => c.id === n.contact_id) || {}).name || "the contact" : about ? rvTargetName(about) : "the notice board")}</span></span></div>`).join("");
  const TM = r.terms || [];
  if (TM.length) {
    const td = aboutDeal || (T.find(t => t.deal_id) || {}).deal_id || "";
    h += `<div class="lbl">Deal terms · ${TM.length}</div><label class="fld" style="margin-top:0"><span>Save the terms on</span><select id="rvTermDeal">${dealOpts(td)}</select></label><div id="rvTerms">${rvTermsHtml(td)}</div>`;
  }
  if (!T.length && !C.length && !N.length && !TM.length && !(q && q.is_quote)) h += `<div class="quiet">Nothing to save was found. Try a clearer photo, or type it instead.</div>`;
  h += `<div class="rvfoot"><button class="wide primary" id="rvSave" type="button">${ic("check")}Save the ticked lines</button><button class="wide" id="rvCopy" type="button">${ic("copy")}Copy all as text</button>
    <div class="quiet">Read by ${esc(/sonnet/i.test(r.model || "") ? "Claude Sonnet" : /haiku/i.test(r.model || "") ? "Claude Haiku" : "Claude")}. Check names and numbers against the original.</div><div class="msg" id="rvMsg"></div></div>`;
  $("rvBody").innerHTML = h; $("rvSheet").classList.remove("hidden"); $("rvSheet").querySelector(".sheet-b").scrollTop = 0; rvFit();
}
window.openReview = openReview;
// text boxes grow to show all their words (no cut-off lines)
function rvFit(root) { (root || $("rvBody")).querySelectorAll("textarea.rv-ta").forEach(t => { t.style.height = "auto"; t.style.height = Math.max(44, t.scrollHeight + 3) + "px"; }); }
function rvTargetName(t) { const [type, id] = t.split(":"); return type === "deal" ? "the deal " + ((dealById(id) || {}).name || "") : ((window._contacts || []).find(c => c.id === id) || {}).name || "the contact"; }
function rvTermsHtml(dealId) {
  const d = dealById(dealId), p = (d && d.params) || {}, TM = (rdResult && rdResult.terms) || [];
  return TM.map((t, i) => { const now = p[t.key], same = now && String(now).trim() === String(t.value).trim();
    return `<div class="rvrow"><label class="rvtick"><input type="checkbox" data-rv="term:${i}"${!d || same || now ? "" : " checked"} aria-label="Save this term"><span class="bx" aria-hidden="true"></span></label><span class="rv-b"><span class="rv-k">${esc(t.label || t.key)}</span>
      <textarea class="rv-in rv-ta" rows="1" data-rvf="term:${i}:value" aria-label="${esc(t.label || t.key)}">${esc(t.value)}</textarea>
      <span class="rv-s">${d ? (same ? "Already the same on the deal" : now ? "On the deal now: " + esc(now) + " – tick to replace" : "Not set on the deal yet") : "Pick a deal above to save terms"}${t.evidence ? " · “" + esc(t.evidence) + "”" : ""}</span></span></div>`; }).join("");
}
$("rvClose").onclick = () => $("rvSheet").classList.add("hidden");
$("rvSheet").addEventListener("change", e => { if (e.target.id === "rvTermDeal") { $("rvTerms").innerHTML = rvTermsHtml(e.target.value); rvFit($("rvTerms")); } });
$("rvSheet").addEventListener("input", e => { if (e.target.matches("textarea.rv-ta")) rvFit(e.target.parentNode); });
$("rvSheet").addEventListener("click", async e => {
  if (e.target.id === "rvSheet") { $("rvSheet").classList.add("hidden"); return; }
  if (e.target.closest("#rvCopy")) { try { await navigator.clipboard.writeText(rvAllText()); toast("Copied."); } catch (er) { toast("Copy not allowed here."); } return; }
  if (e.target.closest("#rvSave")) rvSave();
});
const rvVal = k => { const el = $("rvBody").querySelector(`[data-rvf="${k}"]`); return el ? el.value.trim() : ""; };
const rvOn = k => { const el = $("rvBody").querySelector(`[data-rv="${k}"]`); return !!(el && el.checked); };
function rvAllText() {
  const r = rdResult, L = [r.summary || ""];
  if (r.quote && r.quote.is_quote) L.push("", quoteText(r.quote));
  (r.tasks || []).forEach((t, i) => L.push("• " + (rvVal(`task:${i}:what`) || t.what)));
  (r.contacts || []).forEach((c, i) => L.push("• " + ["name", "company", "phone", "email"].map(k => rvVal(`contact:${i}:${k}`)).filter(Boolean).join(", ")));
  (r.notes || []).forEach((n, i) => L.push("• " + (rvVal(`note:${i}:text`) || n.text)));
  (r.terms || []).forEach((t, i) => L.push(`• ${t.label || t.key}: ${rvVal(`term:${i}:value`) || t.value}`));
  return L.join("\n").trim();
}
async function rvSave() {
  const r = rdResult, about = r._req.about, src = { photo: "a photo", document: "a document", quote: "a WhatsApp quote", voice: "a voice note" }[r._req.kind] || "the reader";
  const done = { tasks: 0, contacts: 0, notes: 0, terms: 0, files: 0 }, errs = [];
  const btn = $("rvSave"); btn.disabled = true; $("rvMsg").textContent = "Saving…";
  const note = async (text, t) => {   // t = "deal:<id>" | "contact:<id>" | ""
    if (DEMO) return null;
    if (!t) { const x = await sb.rpc("add_post", { p_body: text, p_deal: null, p_kind: "post" }); return x.error; }
    const [type, id] = t.split(":"); const row = { field: "note", new_value: text, source: "app" }; row[type + "_id"] = id;
    return (await sb.from("events").insert(row)).error;
  };
  // contacts first, so the tasks and notes can find them
  for (const [i] of (r.contacts || []).entries()) {
    if (!rvOn(`contact:${i}`)) continue;
    const row = { name: rvVal(`contact:${i}:name`), company: rvVal(`contact:${i}:company`), role: rvVal(`contact:${i}:role`), phone: rvVal(`contact:${i}:phone`), email: rvVal(`contact:${i}:email`), notes: `From ${src}, ${dayName(Date.now())}` };
    if (!row.name) continue; row.whatsapp = toWa(row.phone);
    if (DEMO) { done.contacts++; continue; }
    const { error } = await sb.from("contacts").insert(row); if (error) errs.push(row.name + ": " + error.message); else done.contacts++;
  }
  for (const [i, t] of (r.tasks || []).entries()) {
    if (!rvOn(`task:${i}`)) continue;
    const what = rvVal(`task:${i}:what`); if (!what) continue;
    const dealId = rvVal(`task:${i}:deal`), d = dealById(dealId);
    const body = { p_project: d && PROJECTS.includes(d.area) ? d.area : "Other", p_waiting_on: t.waiting_on && !/^me$/i.test(t.waiting_on) ? t.waiting_on : "Me", p_waiting_for: what, p_blocks: "", p_next: "", p_priority: 2, p_owner: rvVal(`task:${i}:owner`) || me || "Chris", p_deal: dealId || null, p_due: rvVal(`task:${i}:due`) || null };
    if (DEMO) { const now = new Date().toISOString(); const it = { id: "r" + Date.now() + i, project: body.p_project, deal_id: body.p_deal, waiting_on: body.p_waiting_on, waiting_for: what, state: "Confirmed", priority: 2, owner: body.p_owner, nudge_after_days: 3, last_chased: now, created_at: now, due_on: body.p_due };
      it._days = 0; it._me = isMe(it); it._stale = it.due_on ? dayDiff(dueDate(it)) < 0 : false; (window._items ||= []).push(it); done.tasks++; continue; }
    let { error } = await sb.rpc("add_item", body);
    if (error && /p_due|function/i.test(error.message)) { const b2 = { ...body }; delete b2.p_due; ({ error } = await sb.rpc("add_item", b2)); }
    if (error) errs.push(what + ": " + error.message); else done.tasks++;
  }
  for (const [i, n] of (r.notes || []).entries()) {
    if (!rvOn(`note:${i}`)) continue;
    const text = rvVal(`note:${i}:text`); if (!text) continue;
    const t = n.deal_id ? "deal:" + n.deal_id : n.contact_id ? "contact:" + n.contact_id : about;
    const error = await note(`${text} (from ${src})`, t); if (error) errs.push(error.message); else done.notes++;
  }
  if (r.quote && r.quote.is_quote && rvOn("quote")) { const error = await note("Quote, tidied by the reader:\n" + quoteText(r.quote), about); if (error) errs.push(error.message); else done.notes++; }
  const tdeal = $("rvTermDeal") ? $("rvTermDeal").value : "", d = dealById(tdeal);
  if (d) {
    const params = { ...(d.params || {}) }; let n = 0;
    (r.terms || []).forEach((t, i) => { if (rvOn(`term:${i}`) && rvVal(`term:${i}:value`) && t.key !== "target" && t.key !== "limit") { params[t.key] = rvVal(`term:${i}:value`); n++; } });
    if (n) { if (DEMO) { d.params = params; done.terms = n; } else { const { error } = await sb.rpc("save_deal", { p_id: d.id, p_params: params }); if (error) errs.push("Terms: " + error.message); else done.terms = n; } }
  }
  // keep the photo or PDF: on the chosen deal or contact, or on the notice board with the summary
  const ctx = r._ctx;
  if (ctx && ctx.keep && ctx.blob && !DEMO) {
    let type = "", id = "";
    if (about) [type, id] = about.split(":");
    else { const x = await sb.rpc("add_post", { p_body: `Read from ${src}: ${r.summary || ""}`.trim(), p_deal: null, p_kind: "post" }); if (!x.error) { type = "post"; id = x.data; } }
    if (type && id) {
      const isPdf = ctx.blob.type === "application/pdf", name = isPdf ? ctx.name : (ctx.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
      const path = `${type}/${id}/${Date.now()}-${name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
      const up = await sb.storage.from("files").upload(path, ctx.blob, { contentType: ctx.blob.type || "application/octet-stream", upsert: false });
      if (up.error) errs.push("File: " + up.error.message);
      else { const a = await sb.from("attachments").insert({ target_type: type, target_id: String(id), path, name, size: ctx.blob.size, mime: ctx.blob.type || "" }); if (a.error) errs.push("File: " + a.error.message); else done.files++; }
    }
  }
  btn.disabled = false;
  const parts = [done.tasks && `${done.tasks} task${done.tasks > 1 ? "s" : ""}`, done.contacts && `${done.contacts} contact${done.contacts > 1 ? "s" : ""}`, done.notes && `${done.notes} note${done.notes > 1 ? "s" : ""}`, done.terms && `${done.terms} term${done.terms > 1 ? "s" : ""}`, done.files && "the file"].filter(Boolean);
  if (errs.length) { $("rvMsg").textContent = (parts.length ? "Saved " + parts.join(", ") + ". " : "") + "Not saved: " + errs.join(" · "); if (!DEMO) load(); return; }
  $("rvSheet").classList.add("hidden");
  toast(parts.length ? `Saved ${parts.join(", ")}${DEMO ? " (demo – not saved)" : ""}.` : "Nothing was ticked, so nothing was saved.", 4000);
  if (DEMO) render(); else load();
}

// ---------- ways in ----------
$("list").addEventListener("click", e => {
  const b = e.target.closest("button[data-readdeal]"); if (!b) return;
  openReader({ kind: "photo", what: "doc", about: "deal:" + b.dataset.readdeal });
});
// Deal page › Numbers: "Read terms from a document"
(window._after ||= []).push(() => {
  if (view !== "deal") return;
  const box = document.querySelector('.dpage .dpanel'), t = document.querySelector('.dtabs4 .dtab.on');
  if (!box || !t || !/numbers$/.test(t.dataset.dtab) || box.querySelector("[data-readdeal]")) return;
  box.insertAdjacentHTML("afterbegin", `<div class="acts0" style="margin:0 0 6px"><button data-readdeal="${esc(dealPage)}">${ic("terms")}Read terms from a document</button></div>`);
});

// ---------- demo mode: sample answers so the review sheet can be tried ----------
function demoRead(req) {
  const d = liveDeals()[0] || {}, today = saDayPlus(0), tmr = saDayPlus(1);
  if (req.kind === "quote") return { summary: "A supplier offers chrome concentrate at a price per ton, collected at the plant.", model: "claude-haiku-demo",
    quote: { is_quote: true, side: "offer", from_who: "Sam (Example Minerals)", product: "Chrome concentrate", grade: "Cr2O3 40–42%", quantity: "5 000 t a month", price: "R2 400", unit: "per ton", vat: "not stated", basis: "FOT", place: "Example plant, Rustenburg", payment: "", validity: "", other: "Trucks from Monday", missing: ["VAT included or not", "Payment terms", "How long the price is valid", "Moisture / DMT basis", "Which assay counts"] },
    tasks: [{ what: "Ask Sam: is R2 400 incl or excl VAT?", waiting_on: "Sam", owner: me || "Chris", due: tmr, deal_id: d.id || "", why: "R2400/t FOT" }, { what: "Ask Sam how long the price is valid", waiting_on: "Sam", owner: me || "Chris", due: "", deal_id: d.id || "" }],
    contacts: [], notes: [{ text: "Supplier can start trucks from Monday", deal_id: d.id || "", contact_id: "" }],
    terms: [{ key: "price", label: "Price", value: "R2 400 per ton", evidence: "2400/t" }, { key: "basis", label: "Incoterm", value: "FOT", evidence: "FOT plant" }] };
  if (req.kind === "voice") return { summary: "Voice note: two jobs and one thing to wait for.", model: "claude-haiku-demo",
    tasks: [{ what: "Send the truck list to the client", waiting_on: "Me", owner: me || "Chris", due: today, deal_id: d.id || "" }, { what: "Signed NCNDA", waiting_on: "Pat", owner: me || "Chris", due: tmr, deal_id: d.id || "" }],
    contacts: [], notes: [{ text: "Client wants 20 loads a month from October", deal_id: d.id || "", contact_id: "" }], terms: [] };
  return { summary: req.kind === "document" ? "A signed offer (FCO) for chrome concentrate." : "Handwritten notes from a call, plus a business card.", model: "claude-sonnet-demo",
    tasks: [{ what: "Book the site visit", waiting_on: "Me", owner: me || "Chris", due: tmr, deal_id: d.id || "", why: "site visit Tue?" }, { what: "Bank letter (proof of funds)", waiting_on: "Dana", owner: me || "Chris", due: "", deal_id: d.id || "" }],
    contacts: req.kind === "document" ? [] : [{ name: "Jordan Sample", company: "Example Logistics", role: "Operations", phone: "021 555 0142", email: "jordan@example.com" }],
    notes: [{ text: "Buyer wants 40–42% and a 1 truck trial first", deal_id: d.id || "", contact_id: "" }],
    terms: [{ key: "grade", label: "Grade / spec", value: "Cr2O3 40–42%", evidence: "40-42%" }, { key: "trial", label: "Trial load", value: "1 truck (34 t)", evidence: "1 truck trial" }, { key: "instrument", label: "Payment instrument", value: "Escrow", evidence: "escrow" }] };
}
