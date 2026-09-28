// Deal Board – the lean deal (28 Sep 2026). Chris: "There is lots of unnecessary stuff in the procedure and forms for deals.
// Also have some drop down options in some of the forms sections", plus his list (docs/WORKFLOW-TEST.md, project doc
// deal-board-requests-2026-09-28): asking price apart from the agreed price · FOT or DAP as one clear choice · "Sourced – yes,
// Annemarie to confirm" · every open question has Not yet / Requested / Still awaiting, each making or moving its follow-up task ·
// LC only after proof of funds · a procedure with only the steps we use · a commission split · the market price.
// Nothing here deletes data: the full kit steps and every old term stay in the database ("Show all steps", "More terms").
// Keys that start with "_" in a deal's params are the app's own (question status, sourced, split) – never shown as terms and
// never sent to anyone.

// ---------- small helpers ----------
const leanP = d => (d && d.params) || {};
const isUnset = v => !v || /^(not agreed|to discuss)$/i.test(String(v).trim());
const keyDay = k => k ? dayName(new Date(k + "T08:00:00+02:00")) : "";
const shortDate = k => { const x = keyDay(k); return x ? x.replace(/^\w+ /, "") : ""; };   // "28 Sep"
const leanOwnKeys = k => /^_/.test(k);
window.isUnset = isUnset; window.keyDay = keyDay; window.shortDate = shortDate;
// a short name for a deal in task texts: the words after the section ("Chrome – Pat stockpile → …" gives "Pat stockpile")
function dealHandle(d) {
  const n = String((d && d.name) || "");
  const mid = (n.split(/\s[–-]\s/)[1] || n).split(/\s*(?:→|->|\/)\s*/)[0].trim();
  return (mid || n).slice(0, 32);
}
window.dealHandle = dealHandle;
// a deal reference for documents: section · date made · 4 letters of the id, e.g. CHR-260927-7F3A
function dealRef(d) {
  const a = String(d.area || d.kind || "DL").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "DL";
  const made = d.created_at ? saDayKey(d.created_at).slice(2).replace(/-/g, "") : saDayPlus(0).slice(2).replace(/-/g, "");
  return `${a}-${made}-${String(d.id).replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}
window.dealRef = dealRef;
const projOf = d => (typeof PROJECTS !== "undefined" && PROJECTS.includes(d.area)) ? d.area : "Other";

// ---------- tasks the app makes for you (follow-ups) ----------
async function leanNewItem(o) {
  const body = { p_project: projOf(o.deal), p_waiting_on: o.on, p_waiting_for: o.what, p_blocks: "", p_next: o.next || "", p_priority: o.prio || 2,
    p_owner: o.owner || me || "Chris", p_deal: o.deal.id, p_due: o.due || null };
  if (DEMO) {
    const now = new Date().toISOString();
    const it = { id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), project: body.p_project, deal_id: body.p_deal, waiting_on: body.p_waiting_on,
      waiting_for: body.p_waiting_for, blocks: "", next_action: body.p_next, state: "Confirmed", priority: body.p_priority, owner: body.p_owner, nudge_after_days: 3,
      last_chased: now, created_at: now, due_on: body.p_due };
    it._days = 0; it._me = isMe(it); it._stale = it.due_on ? dayDiff(dueDate(it)) < 0 : false;
    (window._items ||= []).push(it); return it.id;
  }
  const { data, error } = await sb.rpc("add_item", body); if (error) throw error;
  return data;
}
async function leanItemAct(id, act, val) {
  if (!id) return;
  if (DEMO) {
    const it = (window._items || []).find(x => x.id === id); if (!it) return;
    if (act === "done" || act === "drop") window._items = window._items.filter(x => x !== it);
    else if (act === "chased") { it.last_chased = new Date().toISOString(); it._days = 0; }
    else if (act === "priority") it.priority = +val;
    else if (act === "due") it.due_on = val || null;
    else if (act === "assign") it.owner = val;
    it._stale = it.due_on ? dayDiff(dueDate(it)) < 0 : it._days >= (it.nudge_after_days || 3);
    return;
  }
  const open = (window._items || []).some(x => x.id === id); if (!open && (act === "done" || act === "drop")) return;   // already closed
  const { error } = await sb.rpc("item_action", { p_id: id, p_action: act, p_value: val == null ? null : String(val) }); if (error) throw error;
}
window.leanNewItem = leanNewItem; window.leanItemAct = leanItemAct;
async function leanSaveParams(d, params, msg) {
  if (DEMO) { d.params = params; render(); if (msg) toast(msg + " (demo – not saved)"); return true; }
  const { error } = await sb.rpc("save_deal", { p_id: d.id, p_params: params });
  if (error) { toast("Could not save: " + error.message, 6000); return false; }
  d.params = params; if (msg) toast(msg); load(); return true;
}
window.leanSaveParams = leanSaveParams;

// ---------- the short deal form ----------
const GRADES = {
  Chrome: ["Cr2O3 36–38%", "Cr2O3 38–40%", "Cr2O3 40–42%", "Cr2O3 42–44%", "Cr2O3 44–46%", "Cr2O3 46%+ (met grade)"],
  Manganese: ["Mn 30–32%", "Mn 32–34%", "Mn 34–36%", "Mn 36–38% (semi-carbonate)", "Mn 38–40%", "Mn 44%+ (high grade)"],
};
const PAY_MIN = ["Escrow (TradeSafe)", "TT before each batch", "Cash against documents", "Cash on loading", "LC (MT700) confirmed by SA bank", "LC (MT700)", "SBLC (MT760) – backstop only", "To discuss"];
const INCO_MORE = ["FCA", "DPU", "FOB", "CFR", "CIF", "CPT", "CIP", "EXW (avoid)"];
const CARGO = ["Chrome ore", "Manganese ore", "Coal", "Maize", "Iron ore", "Sand / aggregate", "Containers"];
const TRUCKS = ["34 t side tipper", "Tautliner", "Flatbed / step deck", "Tipper", "Interlink"];
const PAY_TR = ["7 days from invoice", "14 days from invoice", "30 days from statement", "50% up front, 50% on delivery", "Cash on delivery"];
const UNITS = ["per t", "per DMT", "per WMT", "US$ per dmtu"];
const isLC = v => /^(LC|SBLC)\b/i.test(String(v || ""));
// q: a question (Not yet · Requested · Still awaiting while it is open) · side: who we ask
const LEAN_TERMS = {
  mineral: {
    main: [
      { k: "commodity", l: "Commodity", chips: ["Chrome", "Manganese", "Other"] },
      { k: "grade", l: "Grade", sel: p => GRADES[p.commodity] || null, ph: "e.g. Cr2O3 40–42%", q: 1, side: "seller" },
      { k: "form", l: "Form", sel: () => ["ROM", "Lumpy", "Concentrate", "Fines"], q: 1, side: "seller" },
      { k: "volume", l: "Volume", ph: "e.g. 20,000 t a month", q: 1, side: "buyer" },
      { k: "basis", l: "Delivery", either: ["FOT", "DAP"], more: INCO_MORE, q: 1, side: "buyer" },
      { k: "port", l: "Named place", ph: "e.g. Mooinooi plant · buyer's yard", when: p => !isUnset(p.basis) },
      { k: "asking_price", l: "Asking price", ph: "e.g. R2,300", unit: 1, q: 1, side: "seller" },
      { k: "price", l: "Agreed price", ph: "e.g. R2,250", unit: 1, same: "asking_price", q: 1, side: "buyer" },
      { k: "instrument", l: "Payment", sel: () => PAY_MIN, lc: 1, q: 1, side: "buyer" },
      { k: "vat", l: "VAT", chips: ["Included", "Excluded", "Zero-rated export"], q: 1, side: "seller" },
      { k: "seller", l: "Seller", ph: "Company and contact person" },
      { k: "buyer", l: "Buyer", ph: "Company and end user" },
    ],
    more: ["term", "trial", "dmt", "inspector", "weights", "final_assay", "umpire", "seller_chain", "buyer_chain"],
    priv: ["commission", "other_cuts", "target", "limit"],
  },
  transport: {
    main: [
      { k: "cargo", l: "Cargo", sel: () => CARGO, q: 1, side: "client" },
      { k: "route", l: "Route", ph: "From → to", q: 1, side: "client" },
      { k: "distance", l: "Distance", ph: "e.g. 169 km one way" },
      { k: "trucks", l: "Trucks", ph: "How many", q: 1, side: "client" },
      { k: "truck_type", l: "Truck type", sel: () => TRUCKS, q: 1, side: "client" },
      { k: "loads", l: "Loads", ph: "e.g. 20 a month", q: 1, side: "client" },
      { k: "rate_basis", l: "Rate type", chips: ["Per ton", "Flat per load", "Flat – whole job"] },
      { k: "client_rate", l: "Client rate", ph: "e.g. R350/t", phf: p => ({ load: "e.g. R12,000 a load", job: "e.g. R150,000 for the job" })[window.rateBasis ? rateBasis(p) : "ton"], q: 1, side: "client" },
      { k: "haulier_rate", l: "Transporter rate", ph: "e.g. R200/t", phf: p => ({ load: "e.g. R8,500 a load", job: "e.g. R110,000 for the job" })[window.rateBasis ? rateBasis(p) : "ton"], q: 1, side: "transporter" },
      { k: "payment", l: "Payment terms", sel: () => PAY_TR, q: 1, side: "client" },
      { k: "vat", l: "VAT", chips: ["Included", "Excluded"], q: 1, side: "client" },
    ],
    more: ["extras"],
    priv: ["commission", "cuts", "target", "limit"],
  },
};
window.LEAN_TERMS = LEAN_TERMS;
// an old term (More terms / private) as a row definition: short lists become chips, longer ones a drop-down
function legacyDef(kind, k) {
  const t = ((typeof TERMS !== "undefined" && TERMS[kind]) || []).find(x => x[0] === k); if (!t) return { k, l: k, ph: "" };
  const [, label, opt] = t, lab = label.replace(" (private)", "");
  if (Array.isArray(opt)) { const o = opt.filter(x => !/^not agreed$/i.test(x)); return o.length > 4 ? { k, l: lab, sel: () => o } : { k, l: lab, chips: o }; }
  return { k, l: lab, ph: opt, priv: /\(private\)/.test(label) };
}
function leanDef(kind, k) { const L = LEAN_TERMS[kind]; return (L && L.main.find(t => t.k === k)) || legacyDef(kind, k); }
window.leanDef = leanDef;
const leanTyping = new Set();   // rows switched from the list to typing ("Other – type it")
const Q_WORDS = { notyet: "not yet", requested: "requested", awaiting: "still awaiting" };
function qState(q) { return `${Q_WORDS[q.s] || q.s} ${shortDate(q.on)}`.trim(); }
function termChips(d, k, list, v) {
  const opts = [...list, ...(v && !list.includes(v) && !isUnset(v) ? [v] : [])];
  return `<div class="tchips">${opts.map(o => { const on = v === o; return `<button type="button" data-term="${d.id}:${k}" data-v="${esc(o)}" class="${on ? "on" : ""}" aria-pressed="${on}">${esc(o)}</button>`; }).join("")}</div>`;
}
function termSelect(d, t, list, v, p) {
  const blockedLC = t.lc && !pofIn(d);
  const other = v && !list.includes(v) && !isUnset(v);
  const opt = o => { const dis = blockedLC && isLC(o) && o !== v; return `<option value="${esc(o)}"${o === v ? " selected" : ""}${dis ? " disabled" : ""}>${esc(o)}${dis ? " – after proof of funds" : ""}</option>`; };
  return `<select class="tsel" data-tsel="${d.id}:${t.k}" aria-label="${esc(t.l)}"><option value=""${v ? "" : " selected"}>${isUnset(v) && v ? esc(v) : "Choose…"}</option>${list.map(opt).join("")}${other ? opt(v) : ""}<option value="__type">Other – type it</option></select>`;
}
function termInput(d, t, v, priv) {
  return `<input class="tin${priv ? " private" : ""}" data-tin="${d.id}:${t.k}" value="${esc(isUnset(v) ? "" : v)}" placeholder="${priv ? "Type it · only you two see this" : esc(t.ph ? t.ph + " · type it" : "type it")}" autocomplete="off"${t.unit ? ' inputmode="text"' : ""}>`;
}
function unitSelect(d, v) {
  const cur = UNITS.find(u => new RegExp("^" + u.replace(/[$]/g, "\\$&"), "i").test(String(v || "").replace(/\s*\(.*\)$/, ""))) || "";
  const other = v && !cur;
  return `<select class="tsel tunit" data-tsel="${d.id}:unit" aria-label="Price per">${UNITS.map(u => `<option${u === cur ? " selected" : ""}>${u}</option>`).join("")}${other ? `<option selected value="${esc(v)}">${esc(v)}</option>` : ""}${!v ? `<option value="" selected>per …</option>` : ""}</select>`;
}
// FOT or DAP: one switch; "Other" opens the rest of the Incoterms
function eitherHtml(d, t, v) {
  const on = x => String(v || "").toUpperCase().startsWith(x);
  const moreOn = v && !isUnset(v) && !t.either.some(on);
  return `<div class="seg2 teither" role="group" aria-label="${esc(t.l)}">${t.either.map(x => `<button type="button" data-term="${d.id}:${t.k}" data-v="${x}" class="${on(x) ? "on" : ""}" aria-pressed="${on(x)}">${x}</button>`).join("")}<select class="segsel${moreOn ? " on" : ""}" data-tsel="${d.id}:${t.k}" aria-label="Other delivery term"><option value="">${moreOn ? "" : "Other"}</option>${t.more.map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
}
// where an open question stands: a small pill in the row's corner; tapping it opens the phone's own list, which says what
// each choice does (Not yet · Requested · Still awaiting). The pill stays short so the term's name is never cut.
function qSelect(d, k, q, label) {
  const cur = q ? q.s : "";
  const short = cur === "notyet" ? "not yet" : cur === "requested" ? "asked" + (q && q.on ? " " + shortDate(q.on) : "") : cur === "awaiting" ? "awaiting" : "not asked";
  const opt = (v, w) => `<option value="${v}"${cur === v ? " selected" : ""}>${w}</option>`;
  return `<span class="qpill${cur ? " on q-" + cur : ""}">${esc(short)}<select class="qsel" data-qsel="${d.id}:${k}" aria-label="Where ${esc(label)} stands: ${esc(short)}">${opt("", "Not asked yet")}${opt("notyet", "Not yet – remind me today")}${opt("requested", "Requested – follow up in 2 work days")}${opt("awaiting", "Still awaiting – chase tomorrow")}</select></span>`;
}
function termRowHtml(d, t) {
  if (t.phf) { const ph = t.phf(leanP(d)); if (ph) t = Object.assign({}, t, { ph }); }
  const p = leanP(d), v = p[t.k] || "", open = isUnset(v), priv = /^(target|limit)$/.test(t.k) || t.priv;
  const q = (p._q || {})[t.k];
  const state = priv ? "private" : !open ? "set" : q ? qState(q) : (v ? v.toLowerCase() : "not set");
  const corner = t.q && open && !priv ? qSelect(d, t.k, q, t.l) : `<span>${esc(state)}</span>`;
  let ctl;
  if (leanTyping.has(d.id + ":" + t.k)) ctl = termInput(d, Object.assign({}, t, { ph: t.ph || "type it" }), v, priv);
  else if (t.chips) ctl = termChips(d, t.k, t.chips, v);
  else if (t.either) ctl = eitherHtml(d, t, v);
  else if (t.sel && t.sel(p)) ctl = termSelect(d, t, t.sel(p), v, p);
  else ctl = termInput(d, t, v, priv);
  if (t.unit) ctl = `<div class="tpair">${ctl}${unitSelect(d, p.unit)}</div>`;
  let extra = "";
  if (t.same && open && !isUnset(p[t.same])) extra += `<div class="tchips tsame"><button type="button" data-tsame="${d.id}:${t.k}:${t.same}">Same as asking · ${esc(p[t.same])}</button></div>`;
  if (t.lc && isLC(v) && !pofIn(d)) extra += `<div class="tnote">LC comes only after proof of funds – the proof of funds is not in yet (Docs).</div>`;
  if (t.k === "price" && window.marketLine) extra += marketLine(d);
  return `<div class="trow${priv ? " priv" : ""}" data-termrow="${t.k}"><div class="k"><b>${esc(t.l)}</b>${corner}</div>${ctl}${extra}</div>`;
}
// "Sourced": Not yet · Yes – Annemarie to confirm; Annemarie confirms it (her task says so)
function sourcedHtml(d) {
  const s = leanP(d)._src, am = me === "Annemarie";
  let state = "not set", ctl;
  if (!s || s.s === "notyet") {
    state = s ? `not yet ${shortDate(s.on)}` : "not set";
    ctl = `<div class="tchips"><button type="button" data-src="${d.id}" data-v="notyet" class="${s ? "on" : ""}" aria-pressed="${!!s}">Not yet</button><button type="button" data-src="${d.id}" data-v="yes" class="go">${am ? "Yes – sourced" : "Yes – Annemarie to confirm"}</button></div>`;
  } else if (s.s === "yes") {
    state = `annemarie to confirm · ${shortDate(s.on)}`;
    ctl = `<div class="tchips"><button type="button" class="on" aria-pressed="true" disabled>Sourced · ${esc(s.by || "")}</button>${am ? `<button type="button" data-src="${d.id}" data-v="confirm" class="go">Confirm</button>` : ""}<button type="button" data-src="${d.id}" data-v="undo">Not sourced</button></div>`;
  } else {
    state = `confirmed ${shortDate(s.on)}`;
    ctl = `<div class="tchips"><button type="button" class="on" aria-pressed="true" disabled>Confirmed by ${esc(s.by || "Annemarie")}</button><button type="button" data-src="${d.id}" data-v="undo">Undo</button></div>`;
  }
  return `<div class="trow" data-termrow="_src"><div class="k"><b>Sourced</b><span>${esc(state)}</span></div>${ctl}</div>`;
}
function leanTermsHtml(d) {
  const L = LEAN_TERMS[d.kind]; if (!L) return "";
  const p = leanP(d), main = L.main.filter(t => !t.when || t.when(p)), setN = main.filter(t => !isUnset(p[t.k])).length;
  const qOpen = main.filter(t => t.q && isUnset(p[t.k]) && (p._q || {})[t.k]).length;
  let h = rplain(`terms · ${esc((d.area || d.kind).toLowerCase())}`, `${setN} of ${main.length} set${qOpen ? ` · ${qOpen} asked` : ""}`);
  if (d.kind === "mineral") h += sourcedHtml(d);
  h += main.map(t => termRowHtml(d, t)).join("");
  h += rplain("private", "only you two") + L.priv.map(k => termRowHtml(d, legacyDef(d.kind, k))).join("") + splitHtml(d);
  const mk = `more:${d.id}`, mo = isOpen(mk, false), moreSet = L.more.filter(k => !isUnset(p[k])).length;
  h += `<button type="button" class="tmore" data-tog="${mk}" data-dflt="0" aria-expanded="${mo}"><span>More terms</span><span class="m">${moreSet} of ${L.more.length} set</span><span class="chev"></span></button>`;
  if (mo) h += L.more.map(k => termRowHtml(d, legacyDef(d.kind, k))).join("");
  return h;
}
window.leanTermsHtml = leanTermsHtml;
// an answered question closes its follow-up (called by saveTerm with the new params)
window.leanAnswered = function (params, key, value) {
  const q = (params._q || {})[key]; if (!q || isUnset(value)) return [];
  const qs = { ...params._q }; delete qs[key]; if (Object.keys(qs).length) params._q = qs; else delete params._q;
  return q.id ? [q.id] : [];
};

// ---------- a question's status: Not yet · Requested · Still awaiting ----------
function sideName(d, k) {
  const t = leanDef(d.kind, k), p = leanP(d), side = t.side || "them";
  const raw = side === "seller" ? p.seller : side === "buyer" ? p.buyer : side === "client" ? (p.client || p.buyer) : side === "transporter" ? p.transporter : "";
  const name = String(raw || "").split(/[(,;]/)[0].trim().slice(0, 40);
  return name || ({ seller: "Seller", buyer: "Buyer", client: "Client", transporter: "Transporter" }[side] || "Them");
}
async function setQuestion(d, k, s) {
  const p = { ...leanP(d) }, qs = { ...(p._q || {}) }, cur = qs[k], t = leanDef(d.kind, k), label = t.l, who = sideName(d, k), tag = dealHandle(d);
  try {
    if (cur && cur.s === s) {   // tap the chosen one again: back to plain "not set", its follow-up closes
      await leanItemAct(cur.id, "done"); delete qs[k];
      if (Object.keys(qs).length) p._q = qs; else delete p._q;
      return leanSaveParams(d, p, `${label}: status cleared.`);
    }
    let id = cur && cur.id;
    if (s === "notyet") {
      if (id) await leanItemAct(id, "done");
      id = await leanNewItem({ deal: d, on: "Me", what: `Ask ${who}: ${label.toLowerCase()} (${tag})`, next: "Ask", due: saDayPlus(0) });
    } else if (s === "requested") {
      if (id && cur.s === "notyet") { await leanItemAct(id, "done"); id = null; }
      if (id) await leanItemAct(id, "due", workDayPlus(2));
      else id = await leanNewItem({ deal: d, on: who, what: `${label} (${tag})`, next: "Follow up", due: workDayPlus(2) });
    } else if (s === "awaiting") {
      if (id && cur.s === "notyet") { await leanItemAct(id, "done"); id = null; }
      if (id) { await leanItemAct(id, "chased"); await leanItemAct(id, "priority", 1); await leanItemAct(id, "due", workDayPlus(1)); }
      else id = await leanNewItem({ deal: d, on: who, what: `${label} (${tag})`, next: "Chase again", due: workDayPlus(1), prio: 1 });
    }
    qs[k] = { s, on: saDayPlus(0), id: id || null, who, by: me || "" };
    p._q = qs;
    const when = s === "notyet" ? "today" : dayName(new Date((s === "requested" ? workDayPlus(2) : workDayPlus(1)) + "T08:00:00+02:00"));
    return leanSaveParams(d, p, `${label}: ${Q_WORDS[s]} – follow-up ${s === "notyet" ? "on your list today" : "on " + when}.`);
  } catch (e) { toast("Could not save: " + (e.message || e), 6000); }
}
// Sourced: yes → a task for Annemarie to confirm; Annemarie's Confirm closes it
async function setSourced(d, v) {
  const p = { ...leanP(d) }, cur = p._src, tag = dealHandle(d);
  try {
    if (v === "undo" || (v === "notyet" && cur && cur.s === "notyet")) { if (cur && cur.id) await leanItemAct(cur.id, "done"); delete p._src; return leanSaveParams(d, p, "Sourced: cleared."); }
    if (v === "notyet") { if (cur && cur.id) await leanItemAct(cur.id, "done"); const id = await leanNewItem({ deal: d, on: "Me", what: `Find the material (${tag})`, next: "Source it", due: workDayPlus(2) }); p._src = { s: "notyet", on: saDayPlus(0), id, by: me || "" }; return leanSaveParams(d, p, "Sourced: not yet – a follow-up is on your list."); }
    if (v === "yes" && me === "Annemarie") { if (cur && cur.id) await leanItemAct(cur.id, "done"); p._src = { s: "ok", on: saDayPlus(0), by: "Annemarie" }; return leanSaveParams(d, p, "Sourced – confirmed."); }
    if (v === "yes") {
      if (cur && cur.id) await leanItemAct(cur.id, "done");
      const id = await leanNewItem({ deal: d, on: "Me", owner: "Annemarie", what: `Confirm the material is sourced (${tag}) – ${me || "Chris"} says yes`, next: "Open the deal and tap Confirm", due: workDayPlus(1) });
      p._src = { s: "yes", on: saDayPlus(0), id, by: me || "Chris" }; return leanSaveParams(d, p, "Sourced – sent to Annemarie to confirm.");
    }
    if (v === "confirm") { if (cur && cur.id) await leanItemAct(cur.id, "done"); p._src = { s: "ok", on: saDayPlus(0), by: me || "Annemarie" }; return leanSaveParams(d, p, "Sourced – confirmed."); }
  } catch (e) { toast("Could not save: " + (e.message || e), 6000); }
}
$("list").addEventListener("click", e => {
  const q = e.target.closest("button[data-q]");
  if (q) { const [id, k] = q.dataset.q.split(":"), d = dealById(id); if (d) setQuestion(d, k, q.dataset.v); return; }
  const s = e.target.closest("button[data-src]");
  if (s) { const d = dealById(s.dataset.src); if (d) setSourced(d, s.dataset.v); return; }
  const sm = e.target.closest("button[data-tsame]");
  if (sm) { const [id, k, from] = sm.dataset.tsame.split(":"), d = dealById(id); if (d) saveTerm(id, k, leanP(d)[from]); return; }
});
$("list").addEventListener("change", e => {
  const q = e.target.closest("select[data-qsel]"); if (!q) return;
  const [id, k] = q.dataset.qsel.split(":"), d = dealById(id); if (!d) return;
  const cur = ((leanP(d)._q || {})[k] || {}).s || "";
  if (!q.value) { if (cur) setQuestion(d, k, cur); return; }   // "not asked": clears the status and closes its follow-up
  if (q.value !== cur) setQuestion(d, k, q.value);
});
// a drop-down term saves when you pick; "Other – type it" turns the row into a box
$("list").addEventListener("change", e => {
  const el = e.target.closest("select[data-tsel]"); if (!el) return;
  const [id, k] = el.dataset.tsel.split(":");
  if (el.value === "__type") { leanTyping.add(id + ":" + k); render(); setTimeout(() => { const i = document.querySelector(`input[data-tin="${id}:${k}"]`); if (i) i.focus(); }, 30); return; }
  const d = dealById(id);
  if (k === "instrument" && isLC(el.value) && d && !pofIn(d)) toast("LC only after proof of funds – ask for the proof of funds first (Docs).", 5000);
  saveTerm(id, k, el.value);
});
document.addEventListener("focusout", e => { const i = e.target.closest && e.target.closest("input[data-tin]"); if (i && leanTyping.has(i.dataset.tin)) setTimeout(() => { leanTyping.delete(i.dataset.tin); }, 300); });

// ---------- proof of funds (the LC waits for it) ----------
function docRow(dealId, key) { return (window._docs || []).find(x => x.deal_id === dealId && x.doc === key); }
function pofIn(d) { const r = docRow(d.id, "pof"); return !!(r && (r.status === "received" || r.status === "signed")); }
window.docRow = docRow; window.pofIn = pofIn;

// ---------- the short procedure ----------
// The steps a broker really uses, mapped onto the kit's steps (by code) or the old checklist (by title). The full kit stays
// in the database; "Show all steps" brings it back. doc: the Documents row that closes the step; needs: what must come first.
const LEAN_STEPS = {
  mineral: [
    { st: "1. Start", t: "Buyer's needs", codes: ["1.1"], old: /buyer identified/i },
    { st: "1. Start", t: "NCNDA signed", codes: ["1.4"], old: /\bNCNDA\b/i, doc: ["ncnda"] },
    { st: "2. Our cut", t: "IMFPA signed", codes: ["2.1"], old: /IMFPA|commission agreement/i, doc: ["imfpa"] },
    { st: "3. Offers", t: "LOI or ICPO in", codes: ["4.1"], old: /\bLOI\b|\bICPO\b/i, doc: ["loi", "icpo"] },
    { st: "3. Offers", t: "FCO received", codes: ["4.2"], old: /\bFCO\b/i, doc: ["fco"] },
    { st: "4. Checks", t: "Ownership proof", codes: ["5.3"], old: /proof of ownership/i, doc: ["poo"] },
    { st: "4. Checks", t: "Proof of funds", codes: ["3.7"], old: /proof of funds/i, doc: ["pof"] },
    { st: "4. Checks", t: "KYC both sides", codes: ["3.1"], old: /\bKYC\b/i, doc: ["kyc"] },
    { st: "4. Checks", t: "Assay passed", codes: ["5.2"], old: /independent assay/i, doc: ["assay"] },
    { st: "5. Contract", t: "SPA signed", codes: ["6.7"], old: /SPA signed/i, doc: ["spa"] },
    { st: "5. Contract", t: "Payment secured", codes: ["7.1", "7.2"], old: /payment instrument agreed/i, needs: "pof" },
    { st: "6. Delivery", t: "Loads delivered", codes: ["8.1", "8.2"], old: /loaded and weighed/i },
    { st: "6. Delivery", t: "Seller paid", codes: ["11.5"], old: /buyer paid the seller/i },
    { st: "6. Delivery", t: "Commission paid", codes: ["12.2"], old: /our commission received/i },
  ],
  transport: [
    { st: "1. Qualify", t: "Client confirmed", codes: ["t1.1"], old: /client and receiver/i },
    { st: "1. Qualify", t: "Cargo and route", codes: ["t1.2"], old: /cargo, route/i },
    { st: "1. Qualify", t: "Trucks lined up", codes: ["t1.3"], old: /transporter lined up/i },
    { st: "2. Protect", t: "NCNDA signed", codes: ["t2.1"], old: /NCNDA|non-circumvention/i },
    { st: "2. Protect", t: "Split agreed", codes: ["t2.2"], old: /split per ton/i },
    { st: "3. Terms", t: "Client rate set", codes: ["t3.1"], old: /client rate agreed/i, doc: ["quote"] },
    { st: "3. Terms", t: "Payment terms", codes: ["t3.2"], old: /payment terms agreed/i },
    { st: "3. Terms", t: "Transporter rate", codes: ["t3.3"], old: /transporter rate/i },
    { st: "4. Contract", t: "Insurance in", codes: ["t4.2"], old: /GIT insurance/i, doc: ["insurance"] },
    { st: "4. Contract", t: "Contract signed", codes: ["t5.1"], old: /agreement signed with the client/i, doc: ["contract"] },
    { st: "5. Loads", t: "Trial load done", codes: ["t6.1"], old: /trial load delivered/i, doc: ["pod", "tickets"] },
    { st: "5. Loads", t: "Margin paid", codes: ["t8.2"], old: /margin received/i },
  ],
};
window.LEAN_STEPS = LEAN_STEPS;
const leanAll = id => isOpen("allsteps:" + id, false);
window.leanAll = leanAll;
function leanSteps(d, steps) {
  const defs = d && LEAN_STEPS[d.kind]; if (!defs || !steps.length) return steps;
  const used = new Set(), out = [];
  defs.forEach((def, i) => {
    const s = steps.find(x => !used.has(x.id) && ((x.code && def.codes.includes(x.code)) || (!x.code && !x.custom && def.old.test(x.title))));
    if (!s) return; used.add(s.id);
    out.push(Object.assign({}, s, { stage: def.st, title: def.t, sort: i + 1, _lean: def, _full: s.title }));
  });
  steps.filter(x => x.custom && !used.has(x.id)).forEach((s, j) => out.push(Object.assign({}, s, { stage: "Extra steps", sort: 900 + j })));
  return out.length ? out : steps;
}
window.leanSteps = leanSteps;
// the stage a step shows under right now (the short list renames stages)
window.leanStageOf = function (dealId, stepId) {
  const s = (window._steps || []).find(x => x.id === stepId); if (!s) return "";
  const d = dealById(dealId); if (!d || leanAll(dealId)) return s.stage;
  const l = leanSteps(d, stepsOf(dealId)).find(x => x.id === stepId); return l ? l.stage : s.stage;
};
// a document came in or was signed: the step it closes is ticked (a person's own tap – never the bot)
async function leanTickFromDoc(d, docKey, label) {
  const hits = leanSteps(d, stepsOf(d.id)).filter(s => s._lean && (s._lean.doc || []).includes(docKey) && s.status === "open");
  for (const h of hits) {
    const st = (window._steps || []).find(x => x.id === h.id); if (!st) continue;
    const ev = `${label} – in Documents`;
    if (DEMO) { Object.assign(st, { status: "done", done_by: me, done_at: new Date().toISOString(), evidence: st.evidence || ev }); continue; }
    const { error } = await sb.rpc("set_step", { p_id: st.id, p_status: "done", p_evidence: ev });
    if (!error) Object.assign(st, { status: "done", done_by: me, done_at: new Date().toISOString(), evidence: st.evidence || ev });
  }
  return hits.length;
}
window.leanTickFromDoc = leanTickFromDoc;
// who and by when on a step
async function planStep(stepId, owner, due) {
  const st = (window._steps || []).find(x => x.id === stepId); if (!st) return;
  if (DEMO) { Object.assign(st, { owner: owner || null, due_on: due || null }); render(); return; }
  const { error } = await sb.rpc("plan_step", { p_id: stepId, p_owner: owner || null, p_due: due || null });
  if (error) { toast(/plan_step|function/i.test(error.message) ? "Database change 010 is needed for who and when on a step." : "Could not save: " + error.message, 6000); return; }
  Object.assign(st, { owner: owner || null, due_on: due || null }); render();
}
window.planStep = planStep;
$("list").addEventListener("click", e => {
  const b = e.target.closest("button[data-plan]"); if (!b) return;
  const [sid, v] = [b.dataset.plan, b.dataset.v], st = (window._steps || []).find(x => x.id === sid); if (!st) return;
  planStep(sid, st.owner === v ? "" : v, st.due_on || "");
});
$("list").addEventListener("change", e => {
  const i = e.target.closest("input[data-plandue]"); if (!i) return;
  const st = (window._steps || []).find(x => x.id === i.dataset.plandue); if (!st) return;
  planStep(st.id, st.owner || "", i.value || "");
});
// the step panel: who and by when, the document that closes it, what must come first
window.stepPlanHtml = function (s) {
  const d = dealById(s.deal_id); if (!d || s.status !== "open") return "";
  let h = `<div class="lbl">Who does it</div><div class="tchips">${["Chris", "Annemarie", "Both", d.kind === "transport" ? "Client" : "Seller", d.kind === "transport" ? "Transporter" : "Buyer"].map(n => `<button type="button" data-plan="${s.id}" data-v="${n}" class="${s.owner === n ? "on" : ""}" aria-pressed="${s.owner === n}">${n}</button>`).join("")}</div>
    <label class="fld"><span>By when</span><input type="date" data-plandue="${s.id}" value="${esc(s.due_on || "")}"></label>`;
  const L = s._lean;
  if (L && L.needs === "pof" && !pofIn(d)) h += `<div class="tnote">Only after proof of funds – it is not in yet (Docs).</div>`;
  if (L && L.doc && window.docMiniHtml) h += docMiniHtml(d, L.doc);
  return h;
};

// ---------- the next step, first on the Steps tab, with the buttons that move it ----------
window.nextCardHtml = function (d, pg) {
  if (!pg.total) return "";
  if (!pg.next) return `<div class="nextup nextcard"><div class="nu-l">All steps done</div><div class="nu-t">Send the status, or mark the deal Won below.</div></div>`;
  const s = pg.next, L = s._lean || {}, docs = (L.doc || []).map(k => window.docDef && docDef(d.kind, k)).filter(Boolean);
  let acts = "";
  const x = docs.find(z => { const r = docRow(d.id, z.k); return !(r && (r.status === "received" || r.status === "signed")); }) || docs[0];
  if (x) {
    const r = docRow(d.id, x.k), st = r ? r.status : "", got = x.kind === "sign" ? "signed" : "received";
    if (x.tpl && !(r && r.att_id)) acts += `<button type="button" data-tpl="${d.id}:${x.k}">${ic("file")}Make the ${esc(x.l)}</button>`;
    if (st !== "requested") acts += `<button type="button" data-doc="${d.id}:${x.k}" data-v="requested">Requested</button>`;
    acts += `<button type="button" class="primary" data-doc="${d.id}:${x.k}" data-v="${got}">${ic("check")}${got === "signed" ? "Signed" : "Received"}</button>`;
  } else acts += `<button type="button" class="primary" data-step="${s.id}">${ic("list")}Open this step</button>`;
  const r = x ? docRow(d.id, x.k) : null;
  const meta = [s.owner, s.due_on ? "by " + keyDay(s.due_on) : "", L.needs === "pof" && !pofIn(d) ? "only after proof of funds" : "", r && r.status === "requested" ? `${x.l} requested ${shortDate(saDayKey(r.updated_at || Date.now()))}` : ""].filter(Boolean).join(" · ");
  return `<div class="nextup nextcard"><div class="nu-l">Next · ${esc(s.stage)}</div><div class="nu-t">${esc(s.title)}</div>${meta ? `<div class="nu-c">${esc(meta)}</div>` : ""}<div class="acts0">${acts}</div></div>`;
};

// ---------- the commission split (private) ----------
const splitDraft = {};
const commBase = d => { const v = leanP(d).commission; return isUnset(v) ? 0 : (numIn(v) || 0); };
// a transport deal on a flat rate splits a margin per load or for the whole job, not per ton
const splitBasis = d => d.kind === "transport" && window.rateBasis ? rateBasis(leanP(d)) : "ton";
const splitMoney = (d, base, pc, tpl) => { if (!base) return ""; const x = base * pc / 100, b = splitBasis(d); return b === "load" ? `${randR(x)}/load` : b === "job" ? `${randR(x)} for the job` : `${randR2(x)}/t · ${randR(x * tpl)}/load`; };
function splitHtml(d) {
  const p = leanP(d), saved = Array.isArray(p._split) ? p._split : [], ed = splitDraft[d.id], rows = ed || saved;
  const base = commBase(d), tpl = +(ed ? ed.tpl : p._split_t) || 34, perT = d.kind === "transport" ? "margin" : "commission";
  const tot = rows.reduce((a, r) => a + (+r.p || 0), 0), ok = Math.abs(tot - 100) < 0.01;
  const money = pc => splitMoney(d, base, pc, tpl), bu = window.basisUnit ? basisUnit(splitBasis(d)) : " a ton";
  let h = `<div class="trow split" data-splitbox="${d.id}"><div class="k"><b>Commission split</b><span>${rows.length ? (ok ? "100%" : `${fN(tot, 2)}%`) : "not set"}</span></div>`;
  if (!ed) {
    if (!saved.length) h += `<div class="tnote">Who gets what share of our ${perT}${base ? ` (${randR2(base)}${bu})` : ""}. Used for the statements and the IMFPA.</div><div class="acts0"><button type="button" data-split="${d.id}">${ic("plus")}Split the ${perT}</button></div>`;
    else {
      h += `<div class="spl">${saved.map((r, i) => `<div class="spr"><span class="spn">${esc(r.n)}</span><span class="spp">${fN(+r.p, 2)}%</span><span class="spm">${esc(money(+r.p)) || "set our " + perT + " first"}</span>${base ? `<button type="button" class="tag l" data-splitst="${d.id}:${i}">Statement</button>` : ""}</div>`).join("")}</div>`;
      h += `<div class="tnote">${base ? `On our ${perT} of ${randR2(base)}${bu}${splitBasis(d) === "ton" ? ` · ${fN(tpl, 0)} t a load` : ""}` : `Type our ${perT} above to see the rand`}</div><div class="acts0"><button type="button" data-split="${d.id}">${ic("edit")}Change the split</button></div>`;
    }
  } else {
    h += `<div class="spl edit">${ed.map((r, i) => `<div class="spe"><input data-spn="${i}" value="${esc(r.n)}" placeholder="Name" autocomplete="off" aria-label="Name ${i + 1}"><input data-spp="${i}" value="${esc(r.p)}" placeholder="%" inputmode="decimal" aria-label="Share ${i + 1} in %"><span class="spm">${esc(money(+r.p || 0))}</span>${ed.length > 1 ? `<button type="button" class="spx" data-sprm="${i}" aria-label="Remove">×</button>` : ""}</div>`).join("")}</div>
      <div class="spt${ok ? "" : " off"}">${ok ? "Adds up to 100%" : `Adds up to ${fN(tot, 2)}% – ${tot < 100 ? fN(100 - tot, 2) + "% still to place" : fN(tot - 100, 2) + "% too much"}`}</div>
      ${splitBasis(d) === "ton" ? `<label class="fld"><span>Tons a load (for the per-load figure)</span><input data-sptpl="1" value="${esc(ed.tpl || 34)}" inputmode="decimal"></label>` : ""}
      <div class="acts0"><button type="button" data-spadd="${d.id}">${ic("plus")}Add a name</button><button type="button" class="primary" data-spsave="${d.id}">${ic("check")}Save split</button><button type="button" data-spcancel="${d.id}">Cancel</button></div>`;
  }
  return h + `</div>`;
}
window.splitHtml = splitHtml;
function splitRefresh(dealId) {   // keep typing smooth: repaint the money, total and button without re-rendering the page
  const ed = splitDraft[dealId], d = dealById(dealId), box = document.querySelector(`[data-splitbox="${dealId}"]`); if (!ed || !d || !box) return;
  const base = commBase(d), tpl = +ed.tpl || 34, tot = ed.reduce((a, r) => a + (+r.p || 0), 0), ok = Math.abs(tot - 100) < 0.01;
  box.querySelectorAll(".spe").forEach((row, i) => { const m = row.querySelector(".spm"); if (m) m.textContent = ed[i] ? splitMoney(d, base, +ed[i].p || 0, tpl) : ""; });
  const t = box.querySelector(".spt"); if (t) { t.textContent = ok ? "Adds up to 100%" : `Adds up to ${fN(tot, 2)}% – ${tot < 100 ? fN(100 - tot, 2) + "% still to place" : fN(tot - 100, 2) + "% too much"}`; t.classList.toggle("off", !ok); }
  const k = box.querySelector(".k span"); if (k) k.textContent = ok ? "100%" : `${fN(tot, 2)}%`;
}
$("list").addEventListener("click", async e => {
  const o = e.target.closest("button[data-split]");
  if (o) { const d = dealById(o.dataset.split), p = leanP(d), cur = Array.isArray(p._split) && p._split.length ? p._split.map(r => ({ n: r.n, p: String(r.p) })) : [{ n: "Chris", p: "" }, { n: "Annemarie", p: "" }]; cur.tpl = String(p._split_t || 34); splitDraft[d.id] = cur; render(); return; }
  const a = e.target.closest("button[data-spadd]");
  if (a) { const ed = splitDraft[a.dataset.spadd]; if (ed) { ed.push({ n: "", p: "" }); render(); setTimeout(() => { const i = document.querySelector(`input[data-spn="${ed.length - 1}"]`); if (i) i.focus(); }, 30); } return; }
  const r = e.target.closest("button[data-sprm]");
  if (r) { const box = r.closest("[data-splitbox]"), ed = box && splitDraft[box.dataset.splitbox]; if (ed) { ed.splice(+r.dataset.sprm, 1); render(); } return; }
  const c = e.target.closest("button[data-spcancel]");
  if (c) { delete splitDraft[c.dataset.spcancel]; render(); return; }
  const s = e.target.closest("button[data-spsave]");
  if (s) {
    const d = dealById(s.dataset.spsave), ed = splitDraft[d.id]; if (!d || !ed) return;
    const rows = ed.filter(x => String(x.n).trim() || +x.p).map(x => ({ n: String(x.n).trim() || "Unnamed", p: Math.round((+x.p || 0) * 100) / 100 }));
    if (Math.abs(rows.reduce((t, x) => t + x.p, 0) - 100) > 0.01) { toast("The shares must add up to 100%."); return; }
    const p = { ...leanP(d), _split: rows, _split_t: +ed.tpl || 34 };
    delete splitDraft[d.id];
    await leanSaveParams(d, p, "Commission split saved.");
    return;
  }
  const st = e.target.closest("button[data-splitst]");
  if (st && window.openDocSheet) {
    const [id, i] = st.dataset.splitst.split(":"), d = dealById(id), row = (leanP(d)._split || [])[+i]; if (!row) return;
    const calc = (window._calc || {})[id] || {}, v = k => +(String(calc[k] || "").replace(",", ".")) || 0, dmt = v("wmt") * (1 - v("moist") / 100);
    openDocSheet("comm", { deal: `${d.name} – ${row.n}'s share (${fN(row.p, 2)}%)`, qty: dmt ? String(Math.round(dmt * 100) / 100) : "", rate: String(Math.round(commBase(d) * row.p) / 100), vat: "No VAT", due: workDayPlus(7) });
  }
});
document.addEventListener("input", e => {
  const n = e.target.closest && e.target.closest("input[data-spn], input[data-spp], input[data-sptpl]"); if (!n) return;
  const box = n.closest("[data-splitbox]"), ed = box && splitDraft[box.dataset.splitbox]; if (!ed) return;
  if (n.dataset.sptpl) ed.tpl = n.value; else if (n.dataset.spn != null) ed[+n.dataset.spn].n = n.value; else ed[+n.dataset.spp].p = n.value.replace(",", ".");
  splitRefresh(box.dataset.splitbox);
});

// ---------- market price (chrome, manganese) ----------
// Once a week the server reads the public SMM price reports and posts what it finds as Suggested; one tap accepts it.
// A price you type counts at once. Prices in China (CIF, port spot) are shown as they were reported – with the rand
// equivalent on the day where the report is in US dollars – so nobody mistakes them for a South African FOT price.
const MKT_BASIS = ["CIF China", "China port spot", "FOT South Africa", "FOB Richards Bay", "FOB Maputo"];
const MKT_GRADE = { Chrome: ["40–42% concentrate", "42–44% concentrate", "38–40% ROM", "40–42% lumpy", "44–46% concentrate"], Manganese: ["36–37% semi-carbonate", "37% semi-carbonate lumpy", "medium-iron", "high-iron", "44% high grade", "32–34% low grade"] };
let mktForm = null;   // the "type a price" form while it is open
const curSym = c => c === "ZAR" ? "R" : c === "CNY" ? "¥" : "US$";
function mktPrice(r) { const lo = +r.price_low, hi = +r.price_high, s = curSym(r.currency); const f = x => (x >= 100 ? Math.round(x).toLocaleString("en-ZA") : String(Math.round(x * 100) / 100)).replace(/[  ,]/g, " "); return `${s}${lo && hi && lo !== hi ? f(lo) + "–" + f(hi) : f(lo || hi)}/${r.unit || "t"}`; }
function mktRand(r) { if (r.currency === "ZAR") return ""; const fx = +r.fx_zar; if (!fx || r.unit !== "t") return ""; const mid = ((+r.price_low || +r.price_high) + (+r.price_high || +r.price_low)) / 2; return `≈ ${randR(mid * fx)}/t`; }
function mktLatest() {
  const rows = (window._market || []).filter(r => r.status === "accepted"), out = {};
  const dash = x => String(x || "").replace(/[\u2012-\u2015-]/g, "-").toLowerCase();   // "40-42%" and "40–42%" are one grade
  for (const r of rows) { const k = r.commodity + "|" + dash(r.grade) + "|" + r.basis; if (!out[k] || out[k].effective < r.effective) out[k] = r; }
  return Object.values(out).sort((a, b) => a.commodity.localeCompare(b.commodity) || (a.effective < b.effective ? 1 : -1));
}
// the market rail (28 Sep, Chris: "I liked it" – the rail stays): a block per ore and place (chrome · CIF China, manganese ·
// port spot, chrome · FOT South Africa …) so a China price is never listed beside a South African one; one node per price;
// the card: the grade, then the price with the rand on the day and the date under it – every word whole.
function mktCard(r, sugg) {
  const rand = mktRand(r).replace(/\/t$/, "");
  const row = icardRow({ cls: sugg ? "prop" : "ion", attrs: `data-mktrow="${r.id}"`, cardCls: sugg ? "" : "dim", title: esc(r.grade), sub: `${esc(mktPrice(r))}${rand ? " " + esc(rand) : ""} · ${esc(shortDate(r.effective))}`, mono: true });
  return row + (sugg ? `<div class="mkacts2"><button type="button" class="primary" data-mkt="accepted" data-id="${r.id}">${ic("check")}Accept</button><button type="button" data-mkt="dropped" data-id="${r.id}">Drop</button></div>` : "");
}
window.marketHtml = function () {
  const all = window._market || [], latest = mktLatest();
  const last = all.reduce((a, r) => (r.created_at > a ? r.created_at : a), "");
  const place = b => String(b || "").replace(/^China port spot$/, "port spot").replace(/^FOT South Africa$/, "FOT SA");
  const keys = [], seen = new Set();
  for (const r of [...all.filter(r => r.status === "suggested"), ...latest]) { const k = `${r.commodity}|${r.basis}`; if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  keys.sort((a, b) => a.localeCompare(b));   // chrome before manganese, then by place
  let h = sheetOpen("market price", last ? "updated " + esc(dayWords(last)) : "weekly", "mkt") + railOpen(0);
  for (const k of keys) {
    const [c, b] = k.split("|"), sugg = all.filter(r => r.status === "suggested" && r.commodity === c && r.basis === b).slice(0, 3), acc = latest.filter(r => r.commodity === c && r.basis === b).slice(0, 3);
    h += `<section class="iblk"><div class="ilab">${esc(c.toLowerCase())} · ${esc(place(b))}${sugg.length ? " · suggested" : ""}</div><div class="ibody">${sugg.map(r => mktCard(r, true)).join("")}${acc.map(r => mktCard(r, false)).join("")}</div></section>`;
  }
  if (!keys.length) h += `<section class="iblk"><div class="ilab">no price yet</div><div class="ibody"><div class="empty">the Monday check fills it, or type one</div></div></section>`;
  h += railClose();
  if (mktForm) h += mktFormHtml();
  h += `<div class="acts0 mkacts"><button type="button" data-mktadd="1">${ic("edit")}Type a price</button><button type="button" data-mktcheck="1">${ic("refresh")}Check now</button></div>`;
  h += rfoot("prices in China are as reported (CIF or port) – not a South African FOT price") + sheetClose();
  return h;
};
function mktFormHtml() {
  const f = mktForm, grades = MKT_GRADE[f.commodity] || [];
  return `<div class="trow mkform"><div class="k"><b>Type a price</b><span>counts at once</span></div>
    <div class="seg2" role="group" aria-label="Commodity">${["Chrome", "Manganese"].map(c => `<button type="button" data-mktf="commodity" data-v="${c}" class="${f.commodity === c ? "on" : ""}">${c}</button>`).join("")}</div>
    <label class="fld"><span>Grade</span><select data-mktin="grade">${grades.map(g => `<option${f.grade === g ? " selected" : ""}>${esc(g)}</option>`).join("")}</select></label>
    <label class="fld"><span>Basis</span><select data-mktin="basis">${MKT_BASIS.map(b => `<option${f.basis === b ? " selected" : ""}>${esc(b)}</option>`).join("")}</select></label>
    <div class="tpair"><label class="fld"><span>Price</span><input data-mktin="price" value="${esc(f.price || "")}" inputmode="decimal" placeholder="e.g. 318 or 300–320"></label><label class="fld"><span>In</span><select data-mktin="currency">${[["USD", "US$"], ["ZAR", "Rand"], ["CNY", "Yuan"]].map(([v, t]) => `<option value="${v}"${f.currency === v ? " selected" : ""}>${t}</option>`).join("")}</select></label><label class="fld"><span>Per</span><select data-mktin="unit">${["t", "dmtu"].map(u => `<option${f.unit === u ? " selected" : ""}>${u}</option>`).join("")}</select></label></div>
    <div class="acts0"><button type="button" class="primary" data-mktsave="1">${ic("check")}Save price</button><button type="button" data-mktadd="0">Cancel</button></div></div>`;
}
// the reference line under the agreed price on a mineral deal
window.marketLine = function (d) {
  // the price closest to this deal's grade (same words, same % figures), else the newest for the ore
  const p = leanP(d), c = (p.commodity || d.area || ""), g = String(p.grade || "").toLowerCase();
  const nums = s => (String(s).match(/\d+/g) || []).filter(n => +n >= 10);
  const score = x => { const mg = String(x.grade || "").toLowerCase(); let s = 0;
    for (const w of ["semi-carbonate", "high grade", "high-iron", "medium-iron", "lumpy", "concentrate", "rom"]) if (g.includes(w) && mg.includes(w)) s += 3;
    if (nums(g).some(n => nums(mg).includes(n))) s += 2; return s; };
  const r = mktLatest().filter(x => x.commodity === c).sort((a, b) => score(b) - score(a) || (a.effective < b.effective ? 1 : -1))[0]; if (!r) return "";
  return `<div class="tnote">Market ${esc(shortDate(r.effective))}: ${esc(r.grade)}, ${esc(r.basis)} ${esc(mktPrice(r))}${mktRand(r) ? " " + esc(mktRand(r)) : ""} (${esc(String(r.source || "").replace(/ \(.*\)$/, ""))})</div>`;
};
$("list").addEventListener("click", async e => {
  const a = e.target.closest("button[data-mktadd]");
  if (a) { mktForm = a.dataset.mktadd === "1" ? { commodity: "Chrome", grade: MKT_GRADE.Chrome[0], basis: MKT_BASIS[0], currency: "USD", unit: "t", price: "" } : null; render(); return; }
  const f = e.target.closest("button[data-mktf]");
  if (f && mktForm) { mktForm[f.dataset.mktf] = f.dataset.v; if (f.dataset.mktf === "commodity") { mktForm.grade = MKT_GRADE[f.dataset.v][0]; mktForm.unit = f.dataset.v === "Manganese" ? "dmtu" : "t"; } render(); return; }
  const s = e.target.closest("button[data-mktsave]");
  if (s && mktForm) {
    const m = String(mktForm.price || "").replace(/\s/g, "").replace(/,/g, ".").match(/^(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?$/);
    if (!m) { toast("Type the price as a number, e.g. 318 or 300–320."); return; }
    const row = { p_commodity: mktForm.commodity, p_grade: mktForm.grade, p_basis: mktForm.basis, p_low: +m[1], p_high: +(m[2] || m[1]), p_currency: mktForm.currency, p_unit: mktForm.unit, p_effective: saDayPlus(0), p_note: null };
    if (DEMO) { (window._market ||= []).unshift({ id: Date.now(), commodity: row.p_commodity, grade: row.p_grade, basis: row.p_basis, price_low: row.p_low, price_high: row.p_high, currency: row.p_currency, unit: row.p_unit, effective: row.p_effective, source: "typed by " + me, status: "accepted", created_at: new Date().toISOString() }); mktForm = null; render(); toast("Price saved (demo – not saved)."); return; }
    s.disabled = true; const { error } = await sb.rpc("market_price_set", row); s.disabled = false;
    if (error) { toast(/market_price|function/i.test(error.message) ? "Database change 010 is needed for market prices." : "Could not save: " + error.message, 6000); return; }
    mktForm = null; toast("Price saved."); loadMarket(); return;
  }
  const dc = e.target.closest("button[data-mkt]");
  if (dc) {
    const id = +dc.dataset.id, st = dc.dataset.mkt, r = (window._market || []).find(x => +x.id === id);
    if (DEMO) { if (r) r.status = st; render(); toast(st === "accepted" ? "Accepted (demo)." : "Dropped (demo)."); return; }
    dc.disabled = true; const { error } = await sb.rpc("market_price_decide", { p_id: id, p_status: st });
    if (error) { toast("Could not save: " + error.message, 6000); dc.disabled = false; return; }
    if (r) r.status = st; toast(st === "accepted" ? "Price accepted." : "Dropped."); render(); return;
  }
  const ck = e.target.closest("button[data-mktcheck]");
  if (ck) {
    if (DEMO) { toast("Demo: the weekly check reads the public SMM reports on the server."); return; }
    ck.disabled = true; toast("Checking the public price reports…", 0);
    try { const { data, error } = await sb.functions.invoke("tools", { body: { action: "market", force: true } }); if (error) throw error; toast(data && data.note ? data.note : (data && data.added ? `${data.added} new price${data.added === 1 ? "" : "s"} to check.` : "No new price this week."), 5000); }
    catch (er) { toast("Could not check now: " + (er.message || er), 6000); }
    ck.disabled = false; loadMarket();
  }
});
$("list").addEventListener("change", e => { const i = e.target.closest("[data-mktin]"); if (i && mktForm) mktForm[i.dataset.mktin] = i.value; });
document.addEventListener("input", e => { const i = e.target.closest && e.target.closest("input[data-mktin]"); if (i && mktForm) mktForm[i.dataset.mktin] = i.value; });
async function loadMarket() {
  if (DEMO) { if (!window._market) window._market = demoMarket(); return; }
  const { data, error } = await sb.from("market_prices").select("*").neq("status", "dropped").order("effective", { ascending: false }).limit(60);
  window._market = error ? [] : (data || []);
  if (view === "deals" || view === "deal") render();
}
window.loadMarket = loadMarket;
// demo prices: made up for the demo only, marked as such
function demoMarket() {
  const t = saDayPlus(-3), s = saDayPlus(-1), now = new Date().toISOString();
  return [
    { id: 1, commodity: "Chrome", grade: "40–42% concentrate", basis: "CIF China", price_low: 300, price_high: 300, currency: "USD", unit: "t", effective: t, source: "Demo report", fx_zar: 17.5, status: "accepted", created_at: now },
    { id: 2, commodity: "Manganese", grade: "36–37% semi-carbonate", basis: "China port spot", price_low: 35, price_high: 35.5, currency: "CNY", unit: "dmtu", effective: t, source: "Demo report", status: "accepted", created_at: now },
    { id: 3, commodity: "Chrome", grade: "42–44% concentrate", basis: "CIF China", price_low: 320, price_high: 320, currency: "USD", unit: "t", effective: s, source: "Demo report", fx_zar: 17.5, status: "suggested", created_at: now },
  ];
}
(window._after ||= []).push(() => { if (!window._market && !window._mktBusy) { window._mktBusy = true; loadMarket().finally(() => { window._mktBusy = false; }); } });

// ---------- plain-words explanations (28 Sep 2026, Chris: "I need explanation for procedures and what each document is for and why") ----------
// One entry per short-procedure step and per document: what it is, why we need it, who gives it, when it counts as done.
const STAGE_WHY = {
  mineral: [["1. Start", "know exactly what the buyer wants, and lock in the NCNDA before names are shared"], ["2. Our cut", "the IMFPA writes our commission into the deal"], ["3. Offers", "the buyer's LOI or ICPO and the seller's FCO meet in the middle"], ["4. Checks", "is it real? ownership, funds, company papers and an assay"], ["5. Contract", "the SPA is signed, then the buyer's payment is secured"], ["6. Delivery", "loads go, the seller is paid, our commission is paid"]],
  transport: [["1. Qualify", "who pays, what moves where, and trucks that can move it"], ["2. Protect", "the NCNDA and the split per ton, in writing"], ["3. Terms", "client rate with VAT, payment terms, transporter rate"], ["4. Contract", "insurance in and the agreement signed"], ["5. Loads", "a trial load with POD and tickets, then the margin"]],
};
const STEP_WHY = {
  "Buyer's needs": { what: "Write down exactly what the buyer wants: ore, grade, tons a month, where it must be delivered, how they pay.", why: "Everything after this is measured against it. A vague brief wastes weeks.", who: "Us, with the buyer", done: "The requirement is in the deal's terms" },
  "NCNDA signed": { what: "A non-circumvention, non-disclosure agreement: nobody goes around us or shares the other side's contacts.", why: "It protects our commission and our contacts before any names are shared.", who: "Both sides sign, with us", done: "Signed copy in Docs" },
  "IMFPA signed": { what: "The fee protection agreement: the paying party promises our commission on every lot, with the split.", why: "Without it a buyer or seller can forget us once they have each other.", who: "The party that pays the commission, and us", done: "Signed copy in Docs" },
  "LOI or ICPO in": { what: "The buyer's letter of intent (LOI) or firm order (ICPO): quantity, spec and the price they will pay.", why: "It shows the buyer is real and gives the seller enough to make a firm offer.", who: "Buyer", done: "LOI or ICPO in Docs" },
  "FCO received": { what: "The seller's full corporate offer: price, spec, quantity, delivery, payment and how long it holds.", why: "This is the firm offer both sides negotiate from.", who: "Seller", done: "FCO in Docs" },
  "Ownership proof": { what: "Proof the seller owns or may sell the material: mine papers, a stockpile survey or a mandate letter.", why: "Many 'sellers' are brokers with nothing to sell. This stops a deal that cannot deliver.", who: "Seller", done: "Document in Docs and checked" },
  "Proof of funds": { what: "A bank letter or statement showing the buyer has the money for the first lot.", why: "An LC or escrow only makes sense once we know the buyer can pay. It also filters out time-wasters.", who: "Buyer's bank", done: "Proof in Docs" },
  "KYC both sides": { what: "Company papers of both sides: registration, directors, address, VAT (our own KYC sheet too).", why: "Know who you deal with. Banks, lawyers and the SPA ask for it, and it stops fraud.", who: "Both sides, and us", done: "Papers in Docs" },
  "Assay passed": { what: "An independent inspector's test of the material: chrome or manganese content, moisture, size.", why: "The price depends on the grade. The buyer pays on the assay, not on promises.", who: "The inspector, paid as agreed", done: "Certificate in Docs" },
  "SPA signed": { what: "The sale and purchase agreement: the contract with every term.", why: "Nothing is enforceable until it is signed.", who: "Buyer and seller, us as the intermediary", done: "Signed SPA in Docs" },
  "Payment secured": { what: "The buyer's payment is in place: a letter of credit (LC), escrow or the agreed deposit.", why: "The seller only loads once the money is secured. No LC before proof of funds.", who: "Buyer's bank", done: "Bank confirmation in Docs" },
  "Loads delivered": { what: "The material is loaded, weighed and delivered as agreed; tickets and delivery notes are kept.", why: "The weighbridge tickets and the assay decide how much is paid.", who: "Seller and transporter", done: "Tickets and delivery proof in Docs" },
  "Seller paid": { what: "The buyer has paid the seller for the lot.", why: "Our commission is due once the seller is paid.", who: "Buyer", done: "Payment confirmation" },
  "Commission paid": { what: "Our commission (as in the IMFPA) is paid and split as agreed.", why: "The deal is only finished for us when our cut is in the bank.", who: "Paying party", done: "Proof of payment; statements sent" },
  "Client confirmed": { what: "Who pays and who receives: company names and the person who signs.", why: "The invoice must go to the right company and the receiver must expect the loads.", who: "Client", done: "Names and numbers in the terms" },
  "Cargo and route": { what: "What is carried, from where to where, tons a load, loads a month, loading hours.", why: "The rate and the trucks depend on it.", who: "Client", done: "Written confirmation" },
  "Trucks lined up": { what: "A transporter with the right trucks (e.g. 34 t side tippers), how many and from when.", why: "No point quoting loads we cannot move.", who: "Transporter", done: "Written availability" },
  "Split agreed": { what: "Who gets what per ton, in writing: client rate, transporter rate, our margin.", why: "This is our income. Unclear splits end in arguments.", who: "Us, with the transporter", done: "Written split" },
  "Client rate set": { what: "What the client pays – per ton, a flat rate per load, or one amount for the whole job – with VAT stated.", why: "'R350 a ton' without VAT stated is 15% of doubt.", who: "Client", done: "Our quote accepted in writing" },
  "Payment terms": { what: "When the client pays, e.g. 7 days from the POD.", why: "Transporters want paying. The gap between them and the client is our cash risk.", who: "Client", done: "Written payment terms" },
  "Transporter rate": { what: "What the truck costs (per ton or flat, the same way as the client rate), and whether tolls and diesel are in it.", why: "Our margin is the client rate minus the transporter rate.", who: "Transporter", done: "Rate confirmation" },
  "Insurance in": { what: "Goods-in-transit insurance certificate and the vehicle list.", why: "A lost load without insurance is our problem.", who: "Transporter", done: "Certificate in Docs" },
  "Contract signed": { what: "The transport agreement with the client, and with the transporter.", why: "Enforceable terms for rates, payment and liability.", who: "Client and transporter", done: "Signed agreement in Docs" },
  "Trial load done": { what: "The first load delivered, with its POD and weighbridge tickets.", why: "It proves the route, the trucks and the paperwork before the volume starts.", who: "Transporter", done: "POD and tickets in Docs" },
  "Margin paid": { what: "Our margin on the loads is paid.", why: "Finished only when the money is in.", who: "Client", done: "Proof of payment" },
};
const DOC_WHY = {
  ncnda: { what: "Non-circumvention, non-disclosure agreement: nobody goes around us or shares the other side's contacts.", why: "Protects our commission and our names before anyone talks to anyone.", when: "First, before names are shared. Both sides sign; we make it here." },
  imfpa: { what: "Fee protection agreement: the paying party promises our commission on every lot, with the split.", why: "Our income is written into the deal, not left to goodwill.", when: "Right after the NCNDA. We make it here from the split." },
  loi: { what: "Letter of intent: the buyer says what they want to buy and on what terms.", why: "Shows the buyer is serious and gives the seller enough to make a firm offer.", when: "Before the seller's offer. From the buyer; we can draft it." },
  icpo: { what: "Irrevocable corporate purchase order: a firm order with quantity, spec, price and how long it holds.", why: "Stronger than an LOI; sellers and banks act on it.", when: "Instead of, or after, the LOI. From the buyer." },
  fco: { what: "Full corporate offer: the seller's firm offer with price, spec, quantity, delivery, payment and validity.", why: "The offer the buyer accepts or counters.", when: "After the LOI or ICPO. From the seller; we can draft it." },
  poo: { what: "Proof of ownership: mine papers, a stockpile survey or a mandate letter showing the seller may sell.", why: "Stops deals with 'sellers' who have nothing to sell.", when: "Before spending on assays or bank instruments. From the seller." },
  assay: { what: "Assay certificate: an independent inspector's report of the grade, moisture and size.", why: "The price and the payment are based on it.", when: "Before the SPA price is final, then per lot. From the inspector (SGS, Bureau Veritas, Alfred H Knight)." },
  pof: { what: "Proof of funds: a bank letter or statement showing the buyer has the money for the first lot.", why: "No LC or escrow talk before this. It filters out time-wasters.", when: "Before the SPA and any payment instrument. From the buyer's bank." },
  kyc: { what: "KYC company sheet: registration, directors, address, VAT and bank details of each side (ours is made here).", why: "Know who you deal with; banks, lawyers and the SPA need it.", when: "Before the SPA. From both sides." },
  spa: { what: "Sale and purchase agreement: the contract with every term, and what happens when things go wrong.", why: "The only enforceable document. Everything else leads to it.", when: "After the checks, before payment. We draft it here; an attorney checks it once." },
  quote: { what: "Our quote: the rate (per ton or flat), VAT, what is included, with the client's acceptance.", why: "The rate is agreed in writing before the first truck moves.", when: "First. Made in Numbers › Quote PDF." },
  contract: { what: "Transport contract: the agreement with the client (and the transporter) on rates, payment, liability, insurance.", why: "Enforceable terms.", when: "Before the loads start." },
  insurance: { what: "Insurance certificate: goods-in-transit cover and the vehicle list.", why: "A lost or damaged load is covered, not ours to pay.", when: "Before the first load. From the transporter." },
  tickets: { what: "Weighbridge tickets: the weight at loading and at delivery for each load.", why: "The invoice is per ton; the tickets prove the tons.", when: "Every load. From the transporter." },
  pod: { what: "Proof of delivery: the signed delivery note per load.", why: "Payment terms run from the POD. No POD, no payment.", when: "Every load. From the receiver, via the transporter." },
  invoices: { what: "Invoices: ours to the client, and the transporter's to us.", why: "The money trail, with VAT.", when: "Per load or per statement." },
};
window.STAGE_WHY = STAGE_WHY; window.STEP_WHY = STEP_WHY; window.DOC_WHY = DOC_WHY;
const whyLine = (k, v) => v ? `<div class="whyl"><b>${k}</b><span>${esc(v)}</span></div>` : "";
// the explainer inside an open step (short procedure only – the full kit has its own detail text)
window.stepWhyHtml = function (s) {
  const w = s && s._lean && STEP_WHY[s.title]; if (!w) return "";
  return `<div class="why">${whyLine("What", w.what)}${whyLine("Why", w.why)}${whyLine("Who", w.who)}${whyLine("Done when", w.done)}</div>`;
};
// "How this deal runs": one line per stage, folded under the procedure strip
window.howHtml = function (d) {
  const st = STAGE_WHY[d.kind]; if (!st) return "";
  const k = `how:${d.id}`, o = isOpen(k, false);
  let h = `<button type="button" class="tmore" data-tog="${k}" data-dflt="0" aria-expanded="${o}"><span>How a ${d.kind === "transport" ? "transport" : "mineral"} deal runs</span><span class="m">${st.length} stages</span><span class="chev"></span></button>`;
  if (o) h += `<div class="stepp how">${st.map(([n, t]) => `<div class="whyl"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}<div class="quiet" style="margin-top:8px">Open a step for what it is, why, who gives it and when it counts as done. Docs has the same for every document.</div></div>`;
  return h;
};
// the explainer on a document card (tap "What is this?")
window.docWhyHtml = function (dealId, key) {
  const w = DOC_WHY[key]; if (!w) return "";
  const k = `docwhy:${dealId}:${key}`, o = isOpen(k, false);
  return `<button type="button" class="whyb" data-tog="${k}" data-dflt="0" aria-expanded="${o}">${o ? "Hide" : "What is this?"}</button>${o ? `<div class="why">${whyLine("What", w.what)}${whyLine("Why", w.why)}${whyLine("When", w.when)}</div>` : ""}`;
};
