// Deal Board – phone flow, batch 1 (3 Oct 2026, prototype only). The brief: every deal shows one next step, chasing takes two
// taps, and the checks on a deal can be seen at a glance.
//   1 Today › "deals · next step": one card per open deal – name, stage, the one next action, due date, days waiting. "Do next
//     step" opens a pull-up panel (the browser's own <dialog>, no library) where the step is done or its file attached. Done
//     saves the step with the same set_step as the deal page (it goes on the deal's history) and then asks for the next one:
//     who does it and by when.
//   2 Chase: swipe a wait to the left, or tap its Chase pill, for a short list of messages; one tap opens WhatsApp (the wa.me
//     link) with the message typed – the person presses Send. A message never names the other side of the deal.
//   3 Checks on the deal rows: Buyer · Stockpile · Funds – a dot with words beside it; tap one for its list. Display only: they
//     never stop a step. Ticked by a person only, kept with the trust check in the deal's params._trust (the app's own key –
//     never shown as a term and never sent out). Two lines are shared with the trust check (CIPC, proof of ownership).
//   4 App badge: the number of late tasks on the app icon where the phone allows it (iPhone home-screen app on iOS 16.4+, with
//     reminders allowed). Chrome on Android has no number badge – Android shows a dot while a reminder is unread.
// The bot never ticks a check or a step from here: everything below is a person's own tap.

// ---------- small helpers ----------
const flDue = s => {
  if (!s || !s.due_on) return { late: false, text: "no date set" };
  const dt = new Date(s.due_on + "T08:00:00+02:00"), n = dayDiff(dt);
  return n < 0 ? { late: true, text: `${-n} day${n === -1 ? "" : "s"} late` } : { late: false, text: n === 0 ? "due today" : n === 1 ? "due tomorrow" : "by " + dayName(dt) };
};
// days waiting: since the last step was done (or since the deal was made)
function flSince(d) {
  const t = stepsOf(d.id).filter(s => s.status !== "open" && s.done_at).map(s => s.done_at).sort().pop();
  return t || (stepsOf(d.id).length ? d.created_at : d.updated_at) || d.created_at || d.updated_at || null;
}
function flWait(d) { const s = flSince(d); if (!s) return ""; const n = -dayDiff(s); return n <= 0 ? "waiting since today" : `waiting ${n} day${n === 1 ? "" : "s"}`; }
const flDay = k => { const x = new Date(k + "T08:00:00+02:00"); return WDAY[saDate(x).getUTCDay()] + " " + saDate(x).getUTCDate(); };   // "Mon 5"
const FULLDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// the document that closes a step, while it is not in yet
function flDoc(d, s) {
  const keys = (s && s._lean && s._lean.doc) || []; if (!keys.length || !window.docDef) return null;
  return keys.map(k => docDef(d.kind, k)).filter(Boolean).find(x => { const r = docRow(d.id, x.k); return !(r && (r.status === "received" || r.status === "signed")); }) || null;
}
window.stepBuzz = window.stepBuzz || (() => {});

// ---------- the pull-up panel: one <dialog> for the next step, the chase messages and the checks ----------
let FL = null;   // what it shows: { mode: step | after | ms | msnext | chase | gate, dealId, stepId, itemId, gate, note, msg … }
function flDlg() {
  let el = $("flowDlg"); if (el) return el;
  document.body.insertAdjacentHTML("beforeend", `<dialog id="flowDlg" class="sheet fdlg" aria-labelledby="fdTitle"><div class="sheet-b" tabindex="-1" autofocus><div class="sheet-h"><span id="fdTitle"></span><button type="button" data-fd="close">Close</button></div><div id="fdBody"></div></div></dialog>`);
  el = $("flowDlg");
  el.addEventListener("close", () => { FL = null; flHome(); setTimeout(syncSheetHist, 0); });
  el.addEventListener("click", e => { if (e.target === el) el.close(); });   // a tap on the dimmed page closes it
  el.addEventListener("click", flAct);
  el.addEventListener("input", e => { const t = e.target; if (!FL) return; if (t.matches("[data-fdnote]")) FL.note = t.value; if (t.matches("[data-fdms]")) FL.ms = t.value; });
  el.addEventListener("change", e => { const t = e.target; if (t.matches("[data-fddate]") && FL && FL.nextId) { const s = (window._steps || []).find(x => x.id === FL.nextId); planStep(FL.nextId, (s && s.owner) || "", t.value || ""); } });
  return el;
}
// while it is open the toasts and the file picker live inside it – the page under an open dialog can't be seen or used
function flAway() { const el = $("flowDlg"); el.appendChild($("toast")); el.appendChild($("fileInput")); }
function flHome() { for (const x of [$("toast"), $("fileInput")]) if (x && x.parentElement !== document.body) document.body.appendChild(x); }
function flOpen(state) {
  const el = flDlg(); FL = state; flPaint();
  if (!el.open) { try { el.showModal(); } catch (e) { el.setAttribute("open", ""); } flAway(); }
  el.querySelector(".sheet-b").scrollTop = 0;
  setTimeout(syncSheetHist, 0);
}
function flClose() { const el = $("flowDlg"); if (el && el.open) el.close(); }
window.flOpen = flOpen; window.flClose = flClose;
const flSteps = d => dealProgress(d.id).stages.flatMap(g => g.steps);
const flStep = d => FL.stepId ? flSteps(d).find(s => s.id === FL.stepId) : dealProgress(d.id).next;
function flPaint() {
  const el = $("flowDlg"); if (!el || !FL) return;
  const d = FL.dealId ? dealById(FL.dealId) : null;
  let t = "", h = "";
  if (FL.mode === "chase") { const it = (window._items || []).find(i => i.id === FL.itemId); if (!it) { flClose(); return; } t = "Chase " + it.waiting_on; h = flChaseHtml(it); }
  else if (!d) { flClose(); return; }
  else if (FL.mode === "gate") { t = GATE_BY[FL.gate].l + " check"; h = flGateHtml(d, FL.gate); }
  else if (FL.mode === "after") { t = d.name; h = flAfterHtml(d); }
  else if (FL.mode === "ms" || FL.mode === "msnext") { t = d.name; h = flMsHtml(d); }
  else {
    const s = flStep(d);
    if (!s || s.status !== "open") { FL = { mode: "after", dealId: d.id, doneTitle: s ? s.title : "" }; flPaint(); return; }
    t = d.name; h = flStepHtml(d, s);
  }
  // a reload while typing (the phone coming back from WhatsApp or the file picker) keeps the box and the cursor
  const f = document.activeElement, key = f && f.closest && f.closest("#fdBody") ? (f.matches("[data-fdnote]") ? "[data-fdnote]" : f.matches("[data-fdms]") ? "[data-fdms]" : "") : "";
  $("fdTitle").textContent = t;
  $("fdBody").innerHTML = (FL.msg ? `<div class="tnote gate fd-msg" role="alert">${esc(FL.msg)}</div>` : "") + h;
  const n = key && $("fdBody").querySelector(key); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) {} }
}
// repaint after the data changes underneath (a save, a reload)
(window._after ||= []).push(() => { const el = $("flowDlg"); if (FL && el && el.open) flPaint(); });

// Signing an attached document is an explicit action; its own status is not a prior prerequisite.
function flMissing(d, s) {
  const x = flDoc(d, s), r = x && docRow(d.id, x.k), att = r && (window._atts || []).find(a => String(a.id) === String(r.att_id) && a.target_type === "deal" && String(a.target_id) === String(d.id) && a.path);
  return stepGateMissing(d, s.id).filter(m => !(x && att && (!r.expires_on || r.expires_on >= saDayPlus(0)) && m === x.k + ": accepted evidence required"));
}
// ---------- 1 · the next step ----------
function flStepHtml(d, s) {
  const x = flDoc(d, s), r = x ? docRow(d.id, x.k) : null, ours = x && (x.make === "proforma" || x.make === "invoice"), got = x ? (x.kind === "sign" ? "signed" : "received") : "";
  const miss = window.stepGateMissing ? flMissing(d, s) : [], du = flDue(s), pg = dealProgress(d.id), ci = pg.cur ? pg.stages.indexOf(pg.cur) + 1 : pg.stages.length;
  const trust = s._lean && s._lean.trust;
  let h = `<div class="stepp fd-card"><div class="nu-l">stage ${ci} of ${pg.stages.length}${s.stage ? " · " + esc(s.stage.replace(/^\d+\.\s*/, "").toLowerCase()) : ""}</div><div class="nu-t">${esc(s.title)}</div>
    <div class="nu-c">${du.late ? `<i class="dot d-stale" aria-hidden="true"></i>` : ""}${esc([s.owner, du.text, flWait(d)].filter(Boolean).join(" · "))}</div>${x ? `<div class="nu-c">${esc(x.l)}: ${esc(docState(r))}</div>` : ""}${window.stepWhyHtml ? stepWhyHtml(s) : ""}</div>`;
  if (miss.length) h += `<div class="tnote gate">Not yet – first: ${esc(miss.join(", "))}. Tick those first, or open the deal to mark them Not needed.</div>`;
  if (trust) { const k = trust === "buyer" ? "buyer" : "stock", st = gateState(d, GATE_BY[k]); h += `<button type="button" class="wide fd-gate" data-gate="${d.id}:${k}"><i class="dot ${st.dot}" aria-hidden="true"></i>${GATE_BY[k].l} checklist · ${esc(st.word)}</button>`; }
  if (!x) h += `<label class="fld"><span>Proof or note (optional)</span><input data-fdnote="1" maxlength="500" value="${esc(FL.note || "")}" placeholder="${esc(s.closes_with ? "e.g. " + s.closes_with : "e.g. signed copy in Files")}"></label>`;
  const b = [];
  if (!miss.length) b.push(`<button type="button" class="primary" data-fd="done">${ic("check")}${x ? (got === "signed" ? "Signed" : ours ? "Sent" : "Received") : "Done"}</button>`);
  if (x && !ours && (!r || r.status !== "requested")) b.push(`<button type="button" data-fd="req">${ic("send")}Requested</button>`);
  b.push(`<button type="button" data-fd="attach">${ic("clip")}Attach the file</button>`);
  if (x && x.tpl && !(r && r.att_id)) b.push(`<button type="button" data-fd="tpl">${ic("file")}Make the ${esc(x.l)}</button>`);
  b.push(`<button type="button" data-fd="open">${ic("open")}Open the deal</button>`);
  return h + `<div class="acts0 fd-acts">${b.join("")}</div>`;
}
function flAfterHtml(d) {
  const nx = dealProgress(d.id).next;
  let h = FL.doneTitle ? `<div class="fd-ok"><i class="dot d-ok" aria-hidden="true"></i><span>Done: ${esc(FL.doneTitle)} – on the deal's history.</span></div>` : "";
  if (!nx) return h + `<div class="stepp fd-card"><div class="nu-t">All steps done</div><div class="nu-c">Send the status, or mark the deal Won on its page.</div></div><div class="acts0 fd-acts"><button type="button" class="primary" data-fd="open">${ic("open")}Open the deal</button><button type="button" data-fd="close">Close</button></div>`;
  FL.nextId = nx.id;
  const du = flDue(nx), sides = d.kind === "transport" ? ["Client", "Transporter"] : ["Seller", "Buyer"];
  const days = [["Today", saDayPlus(0)], ...[1, 3, 5].map(n => [flDay(workDayPlus(n)), workDayPlus(n)])];
  h += `<div class="stepp fd-card"><div class="nu-l">next step · ${esc(nx.stage.replace(/^\d+\.\s*/, "").toLowerCase())}</div><div class="nu-t">${esc(nx.title)}</div><div class="nu-c">${esc(nx.owner || nx.due_on ? [nx.owner, nx.due_on ? du.text : ""].filter(Boolean).join(" · ") : "Who does it, and by when?")}</div></div>`;
  h += `<div class="lbl">Who does it</div><div class="fd-chips">${["Chris", "Annemarie", "Both", ...sides].map(n => `<button type="button" data-fdown="${n}" class="${nx.owner === n ? "on" : ""}" aria-pressed="${nx.owner === n}">${esc(pname(n))}</button>`).join("")}</div>`;
  h += `<div class="lbl">By when</div><div class="fd-chips">${days.map(([w, k]) => `<button type="button" data-fddue="${k}" class="${nx.due_on === k ? "on" : ""}" aria-pressed="${nx.due_on === k}">${esc(w)}</button>`).join("")}</div><label class="fld"><span>Or pick a date</span><input type="date" data-fddate="1" value="${esc(nx.due_on || "")}"></label>`;
  return h + `<div class="acts0 fd-acts"><button type="button" class="primary" data-fd="now">${ic("check")}Do it now</button><button type="button" data-fd="close">Later</button></div>`;
}
// a deal with no checklist: its next step is the "next milestone" line
function flMsHtml(d) {
  const m = String(d.next_milestone || "").trim();
  if (FL.mode === "ms" && m) return `<div class="stepp fd-card"><div class="nu-l">next step</div><div class="nu-t">${esc(m)}</div><div class="nu-c">${esc(flWait(d))}</div></div><label class="fld"><span>Note (optional)</span><input data-fdnote="1" maxlength="500" value="${esc(FL.note || "")}"></label><div class="acts0 fd-acts"><button type="button" class="primary" data-fd="msdone">${ic("check")}Done</button><button type="button" data-fd="attach">${ic("clip")}Attach the file</button><button type="button" data-fd="open">${ic("open")}Open the deal</button></div>`;
  return (FL.doneTitle ? `<div class="fd-ok"><i class="dot d-ok" aria-hidden="true"></i><span>Done: ${esc(FL.doneTitle)} – on the deal's notes.</span></div>` : "")
    + `<label class="fld"><span>What is the next step?</span><input data-fdms="1" maxlength="200" value="${esc(FL.ms || "")}" placeholder="e.g. Written agreement from the client"></label><div class="acts0 fd-acts"><button type="button" class="primary" data-fd="mssave">${ic("check")}Save the next step</button><button type="button" data-fd="close">Later</button></div>`;
}
function openNext(id) {
  const d = dealById(id); if (!d) return;
  const pg = dealProgress(id);
  flOpen(pg.total ? (pg.next ? { mode: "step", dealId: id, stepId: pg.next.id } : { mode: "after", dealId: id }) : { mode: String(d.next_milestone || "").trim() ? "ms" : "msnext", dealId: id });
}
window.openNext = openNext;
// Done: the same save as the deal page (set_step writes the line on the deal's history); a document step is marked in Docs,
// which ticks its step the way the Docs tab does. Hard stops stay: a gated step can't be Done here either.
async function flDone(d) {
  const s = flStep(d); if (!s || s.status !== "open") return;
  const miss = window.stepGateMissing ? flMissing(d, s) : [];
  if (miss.length) { FL.msg = "Not yet – first: " + miss.join(", ") + "."; flPaint(); return; }
  const x = flDoc(d, s), st = (window._steps || []).find(z => z.id === s.id); if (!st) return;
  FL.msg = "";
  if (x) {
    await setDoc(d, x.k, x.kind === "sign" ? "signed" : "received");
    if (st.status === "open") { FL.msg = `${x.l} is marked in Docs; the step stays open – open the deal to see why.`; flPaint(); return; }
  } else {
    const ev = String(FL.note || "").trim(), now = new Date().toISOString();
    if (DEMO) {
      Object.assign(st, { status: "done", done_by: me, done_at: now, evidence: ev || st.evidence });
      (window._hist ||= []).unshift({ id: "h" + Date.now(), deal_id: d.id, item_id: null, field: "step", old_value: "", new_value: `${st.title} — done${ev ? ` (${ev})` : ""}`, changed_by: me, changed_at: now });
    } else {
      const { error } = await sb.rpc("set_step", { p_id: st.id, p_status: "done", p_evidence: ev || null });
      if (error) { FL.msg = "Could not save the tick: " + error.message; flPaint(); return; }
      Object.assign(st, { status: "done", done_by: me, done_at: now, evidence: ev || st.evidence });
    }
    toast(`Done: ${s.title}${DEMO ? " (demo)" : ""}`); stepBuzz();   // (a document step buzzes in leanTickFromDoc)
  }
  FL = { mode: "after", dealId: d.id, doneTitle: s.title }; flPaint();
  if (DEMO) render(); else load();
}
async function flMsDone(d) {
  const m = String(d.next_milestone || "").trim(), ev = String(FL.note || "").trim(), text = `Done: ${m}${ev ? " – " + ev : ""}`;
  if (DEMO) (window._notes ||= []).unshift({ id: "n" + Date.now(), item_id: null, deal_id: d.id, new_value: text, changed_by: me, changed_at: new Date().toISOString(), source: "app" });
  else { const { error } = await sb.from("events").insert({ field: "note", new_value: text, source: "app", deal_id: d.id }); if (error) { FL.msg = "Could not save: " + error.message; flPaint(); return; } }
  stepBuzz();
  FL = { mode: "msnext", dealId: d.id, doneTitle: m }; flPaint();
  if (DEMO) render(); else load();
}
async function flMsSave(d) {
  const v = String(FL.ms || "").trim(); if (!v) { FL.msg = "Type the next step first."; flPaint(); return; }
  if (DEMO) d.next_milestone = v;
  else { const { error } = await sb.rpc("save_deal", { p_id: d.id, p_next_milestone: v }); if (error) { FL.msg = "Could not save: " + error.message; flPaint(); return; } d.next_milestone = v; }
  toast("Next step saved" + (DEMO ? " (demo)." : ".")); flClose(); if (DEMO) render(); else load();
}

// Today: one card per open deal, late ones first
function dnxCard(r) {
  const { d, pg, s, du } = r, ci = pg.cur ? pg.stages.indexOf(pg.cur) + 1 : pg.stages.length;
  const x = s ? flDoc(d, s) : null, rq = x && docRow(d.id, x.k), req = rq && rq.status === "requested" ? `${x.l} requested ${shortDate(saDayKey(rq.updated_at || Date.now()))}` : "";
  const label = s ? `stage ${ci} of ${pg.stages.length} · ${s.stage.replace(/^\d+\.\s*/, "").toLowerCase()}` : pg.total ? "all steps done" : "next step";
  const action = s ? s.title : pg.total ? "Send the status, or mark it Won" : (String(d.next_milestone || "").trim() || "No next step written yet");
  const meta = s ? [s.owner, du.text, flWait(d), req] : pg.total ? [] : [flWait(d)];
  const go = pg.total && !s ? "" : `<button type="button" class="primary" data-donext="${d.id}">${ic("check")}${s || String(d.next_milestone || "").trim() ? "Do next step" : "Set the next step"}</button>`;
  return `<div class="nextup nextcard dnx" data-dnx="${d.id}"><div class="nu-l">${esc(label)}</div><div class="nu-t">${esc(action)}</div><div class="nu-c dnx-n">${esc(d.name)}${DealControls.flags(d).length ? " · Review Required" : d.status === "On hold" ? " · on hold" : ""}</div>${meta.filter(Boolean).length ? `<div class="nu-c">${s && du.late ? `<i class="dot d-stale" aria-hidden="true"></i>` : ""}${esc(meta.filter(Boolean).join(" · "))}</div>` : ""}<div class="acts0 fd-acts">${go}<button type="button"${go ? "" : ` class="primary"`} data-tgo="deal:${d.id}">${ic("open")}Open deal</button></div></div>`;
}
window.dealNextHtml = function () {
  const ds = liveDeals().filter(d => !window.inSecDeal || inSecDeal(d)); if (!ds.length) return "";
  const rows = ds.map(d => { const pg = dealProgress(d.id), s = pg.next, du = flDue(s); return { d, pg, s, du, dueK: (s && s.due_on) || "9999", since: String(flSince(d) || "") }; })
    .sort((a, b) => (b.du.late - a.du.late) || (!!b.s - !!a.s) || a.dueK.localeCompare(b.dueK) || a.since.localeCompare(b.since));
  const k = "home:dnx:all", all = isOpen(k, false), shown = all ? rows : rows.slice(0, 4);
  let h = `<section class="dnxs" aria-label="Deals – the next step on each">${rplain("deals · next step", `${ds.length} open`)}${shown.map(dnxCard).join("")}`;
  if (rows.length > 4) h += `<button type="button" class="wide dnx-more" data-tog="${k}" data-dflt="0">${all ? "Show fewer deals" : `Show ${rows.length - 4} more deal${rows.length - 4 === 1 ? "" : "s"}`}</button>`;
  return h + `</section>`;
};

// ---------- 2 · chase on WhatsApp ----------
// the wait in words a message can carry: the app's own follow-ups read "NCNDA (Pat stockpile)" – the bracket names the other side
// of the deal, so it never goes into a message
function chaseWhat(it) {
  let w = String(it.waiting_for || "").trim(); const d = it.deal_id ? dealById(it.deal_id) : null;
  if (d && window.dealHandle) { const hd = dealHandle(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); w = w.replace(new RegExp("\\s*\\(\\s*" + hd + "\\s*\\)\\s*$", "i"), ""); }
  return w;
}
function chaseCtx(it) {
  const cs = contactsFor(it.waiting_on).filter(c => c.whatsapp || c.phone);
  const c = cs.find(x => x.id === FL.contactId) || cs[0] || null, name = c ? c.name : it.waiting_on;
  const first = /[&,]|\band\b/i.test(name) ? "" : firstName(name), hi = first ? `Hi ${first}` : "Hi", sign = me ? `Thanks, ${me}` : "Thanks";
  const what = chaseWhat(it), asked = -dayDiff(it.last_chased || it.created_at), nk = workDayPlus(1), byW = nk === saDayPlus(1) ? "tomorrow" : FULLDAY[new Date(nk + "T12:00:00Z").getUTCDay()];
  const T = [
    ["Friendly check-in", `${hi}, a quick check-in on “${what}”. Any news? ${sign}`],
    ["Need it by a day", `${hi}, could you send “${what}” by ${byW}? We need it to move ahead. ${sign}`],
    ["Still waiting", `${hi}, I'm following up again on “${what}”${asked > 0 ? ` – we asked ${asked === 1 ? "yesterday" : asked + " days ago"}` : ""}. Please let me know where it stands today. ${sign}`],
    ["Ask for a call", `${hi}, can we have a quick call about “${what}”? What time suits you? ${sign}`],
  ];
  return { cs, c, what, T, num: c ? (c.whatsapp || toWa(c.phone)) : "" };
}
function flChaseHtml(it) {
  const k = chaseCtx(it), mark = FL.mark !== false;
  let h = `<div class="stepp fd-card"><div class="nu-l">${esc(sinceWords(it))} · ${esc(dueWords(it))}</div><div class="nu-t">${esc(k.what)}</div><div class="nu-c">${k.c ? `To ${esc(k.c.name)} · ${esc(k.c.whatsapp || k.c.phone)}` : `No WhatsApp number saved for ${esc(it.waiting_on)} – WhatsApp will ask which chat.`}</div></div>`;
  if (k.cs.length > 1) h += `<div class="lbl">Send to</div><div class="fd-chips">${k.cs.map(c => `<button type="button" data-fdto="${esc(c.id)}" class="${k.c === c ? "on" : ""}" aria-pressed="${k.c === c}">${esc(firstName(c.name))}</button>`).join("")}</div>`;
  h += `<div class="trow trust fd-mark"><div class="tlist"><button type="button" class="tck${mark ? " on" : ""}" data-fd="mark" aria-pressed="${mark}"><i aria-hidden="true">${mark ? "✓" : ""}</i><span>Mark it chased today<small class="fd-h">when you pick a message – the reminder starts again</small></span></button></div></div>`;
  h += `<div class="lbl">Pick a message – WhatsApp opens with it typed; you press Send</div><div class="trow fd-tpls">${k.T.map(([l, m], i) => `<button type="button" class="fd-tpl" data-fdwa="${i}"><b>${esc(l)}</b><span>${esc(m)}</span></button>`).join("")}</div>`;
  return h + `<div class="acts0 fd-acts"><button type="button" data-fd="chased">${ic("refresh")}Chased – no message</button><button type="button" data-fd="tomorrow">${ic("clock")}Move to ${esc(nextWorkWord())}</button></div>`;
}
function openChase(id) { const it = (window._items || []).find(i => i.id === id); if (it) flOpen({ mode: "chase", itemId: id, mark: true }); }
window.openChase = openChase;
window.waOpen = window.waOpen || (url => { location.href = url; });   // the same wa.me link the app has always used
async function chaseSend(i) {
  const it = (window._items || []).find(x => x.id === FL.itemId); if (!it) return;
  const k = chaseCtx(it), m = k.T[i]; if (!m) return;
  if (FL.mark !== false) { try { await leanItemAct(it.id, "chased"); } catch (e) { toast("Could not mark it chased: " + (e.message || e), 5000); } }
  const url = `https://wa.me/${k.num}?text=` + encodeURIComponent(m[1]);
  window._lastWa = url; flClose(); if (DEMO) render(); else load();
  waOpen(url);
}

// ---------- 3 · the checks: Buyer · Stockpile · Funds ----------
const GATES = Object.entries(DealControls.verification).map(([side, def]) => ({ k: side === "seller" ? "stock" : side, l: def.l, side,
  items: def.items.map(([k, l, must]) => [k, l + (must ? "" : " (if you can)"), k === "how" ? "choice" : "trust"]) }));
const GATE_BY = Object.fromEntries(GATES.map(g => [g.k, g]));
const FUND_HOW = ["Phoned the bank on a number we found ourselves", "Our bank confirmed it with theirs", "An attorney or escrow confirmed it", "Only saw the letter – not confirmed"];
window.GATES = GATES; window.FUND_HOW = FUND_HOW;
function gateState(d, g) {
  const v = DealControls.verified(d, g.side, controlState());
  return { ...v, word: v.ok ? "verified" : v.done ? `${v.done} of ${v.all}` : "not checked", dot: v.ok ? "d-ok" : v.done ? "d-prop" : "d-none" };
}
window.gateState = gateState;
// on a deal row: three buttons, each a dot with the words beside it (mineral deals – a transport deal has no stockpile)
window.gateRowHtml = function (d) {
  if (d.kind !== "mineral") return "";
  return `<div class="gates" role="group" aria-label="Checks on this deal">${DealControls.flags(d).length ? `<span class="quiet"><i class="dot d-stale"></i> Review Required</span>` : ""}${GATES.map(g => { const s = gateState(d, g); return `<button type="button" class="gate" data-gate="${d.id}:${g.k}" aria-label="${g.l} check: ${s.word}. Tap for the list."><i class="dot ${s.dot}" aria-hidden="true"></i><span class="gt">${g.l}</span><span class="gs">${s.word}</span></button>`; }).join("")}</div>`;
};
const flNorm = s => String(s || "").toLowerCase().replace(/\((?:pty|demo)\)|\b(?:pty|ltd|limited|inc|llc|jsc|cc|co)\b|[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function gateHint(d, k, ik) {
  if (k === "buyer" && ik === "nodnd") {
    const b = String(leanP(d).buyer || "").trim(), dnd = (window._leads || []).filter(l => l.status === "dnd");
    if (!b) return "Type the buyer's name in Numbers › Terms and the app checks it against the list";
    const nb = flNorm(b), hit = dnd.find(l => { const n = flNorm(l.name); return n.length > 3 && (nb.includes(n) || (nb.length > 3 && n.includes(nb))); });
    return hit ? `Careful: ${hit.name} is on the Do not deal list` : `The app found no match on the Do not deal list (${dnd.length} name${dnd.length === 1 ? "" : "s"})`;
  }
  if (k === "funds" && ik === "pof") { const r = docRow(d.id, "pof"); return r && (r.status === "received" || r.status === "signed") ? "In Docs: received " + shortDate(saDayKey(r.updated_at || Date.now())) : r && r.status === "requested" ? "Asked for in Docs – not in yet" : "Not in Docs yet"; }
  if (k === "stock" && ik === "owner") { const r = docRow(d.id, "poo"); return r && (r.status === "received" || r.status === "signed") ? "In Docs: proof of ownership received" : ""; }
  return "";
}
function flGateHtml(d, k) {
  const g = GATE_BY[k], s = gateState(d, g), t = (DealControls.trust(d)[g.side]) || {};
  const who = v => v && (v.by || v.on) ? `<small>${esc([v.by, v.on ? shortDate(v.on) : ""].filter(Boolean).join(" · "))}</small>` : "";
  let h = `<div class="fd-ok"><i class="dot ${s.dot}" aria-hidden="true"></i><span>${esc(d.name)} · ${s.ok ? "verified" : s.done ? `${s.done} of ${s.all} ticked` : "not checked yet"}</span></div><div class="trow trust"><div class="tlist">`;
  for (const [ik, l, typ] of g.items) {
    if (typ === "choice") { h += `<div class="fd-sub">${esc(l)}</div>` + FUND_HOW.map((o, n) => { const on = !!(t[ik] && t[ik].v === o); return `<button type="button" class="tck${on ? " on" : ""}" data-gfund="${d.id}:${n}" aria-pressed="${on}"><i aria-hidden="true">${on ? "✓" : ""}</i><span>${esc(o)}${on ? who(t[ik]) : ""}</span></button>`; }).join(""); continue; }
    const v = g.side === "funds" && ik === "pof" ? DealControls.documentOK(d, "pof", controlState()) : t[ik], hint = gateHint(d, k, ik), attr = typ === "trust" ? `data-trust="${d.id}:${g.side}:${ik}"` : `data-gtick="${d.id}:${g.side}:${ik}"`;
    h += `<button type="button" class="tck${v ? " on" : ""}" ${attr} aria-pressed="${!!v}"><i aria-hidden="true">${v ? "✓" : ""}</i><span>${esc(l)}${who(v)}${hint ? `<small class="fd-h">${esc(hint)}</small>` : ""}</span></button>`;
  }
  h += `</div></div><div class="quiet fd-note">Ticked by you or ${esc(pname(otherPartner(me)))} only – the bot never ticks these. These checks control critical progression. Funds also needs attached proof of funds.</div>`;
  return h + `<div class="acts0 fd-acts"><button type="button" data-fd="open">${ic("open")}Open the deal</button><button type="button" data-fd="close">Close</button></div>`;
}
function openGate(id, k) { if (dealById(id) && GATE_BY[k]) flOpen({ mode: "gate", dealId: id, gate: k }); }
window.openGate = openGate;
// ---------- the panel's buttons ----------
async function flAct(e) {
  const b = e.target.closest("button"); if (!b || !FL) return;
  const d = FL.dealId ? dealById(FL.dealId) : null, a = b.dataset.fd;
  if (b.dataset.fdown && FL.nextId) { const s = (window._steps || []).find(x => x.id === FL.nextId); if (s) planStep(s.id, s.owner === b.dataset.fdown ? "" : b.dataset.fdown, s.due_on || ""); return; }
  if (b.dataset.fddue && FL.nextId) { const s = (window._steps || []).find(x => x.id === FL.nextId); if (s) planStep(s.id, s.owner || "", s.due_on === b.dataset.fddue ? "" : b.dataset.fddue); return; }
  if (b.dataset.fdto) { FL.contactId = b.dataset.fdto; flPaint(); return; }
  if (b.dataset.fdwa != null) { b.disabled = true; await chaseSend(+b.dataset.fdwa); return; }
  if (!a) return;
  if (a === "close") { flClose(); return; }
  if (a === "mark") { FL.mark = FL.mark === false; flPaint(); return; }
  if (a === "chased" || a === "tomorrow") { const id = FL.itemId; flClose(); swAct(a, id); return; }
  if (!d) return;
  const s = FL.mode === "step" ? flStep(d) : null, x = s ? flDoc(d, s) : null;
  if (a === "open") { const sid = s ? s.id : ""; flClose(); goTo("deal:" + d.id + (sid ? ":" + sid : "")); return; }
  if (a === "done") { b.disabled = true; await flDone(d); return; }
  if (a === "req" && x) { b.disabled = true; await setDoc(d, x.k, "requested"); return; }
  if (a === "tpl" && x) { flClose(); openTpl(d, x.k); return; }
  if (a === "attach") { pendingAttach = x ? { type: "deal", id: d.id, doc: x.k } : { type: "deal", id: d.id }; $("fileInput").value = ""; $("fileInput").click(); return; }
  if (a === "now" && FL.nextId) { FL = { mode: "step", dealId: d.id, stepId: FL.nextId }; flPaint(); $("flowDlg").querySelector(".sheet-b").scrollTop = 0; return; }
  if (a === "msdone") { b.disabled = true; await flMsDone(d); return; }
  if (a === "mssave") { b.disabled = true; await flMsSave(d); return; }
}
document.addEventListener("click", e => {
  const n = e.target.closest && e.target.closest("button[data-donext]"); if (n) { openNext(n.dataset.donext); return; }
  const g = e.target.closest && e.target.closest("button[data-gate]"); if (g) { const [id, k] = g.dataset.gate.split(":"); openGate(id, k); }
});

// ---------- 4 · the number on the app icon ----------
// late tasks on the signed-in person's own list (all sections – the same count as Today's Late tile on All sections).
// Only where the phone has the badge (iPhone home-screen app, iOS 16.4+) and reminders are allowed; never in the demo.
function badgeCount() {
  const target = me || "Chris", own = x => (x.owner || "Chris") === target || x.owner === "Both";
  const late = (window._items || []).filter(i => i.state !== "Proposed" && own(i) && dayDiff(dueDate(i)) < 0).length;
  const fu = (window._ltasks || []).filter(t => window.isFollowUp && isFollowUp(t) && own(t) && dayDiff(dueDate({ due_on: t.not_before })) < 0).length;
  return late + fu;
}
window.badgeCount = badgeCount;
function badgeApply(n) {
  if (!("setAppBadge" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return false;
  if (window._badgeSet === n) return true; window._badgeSet = n;
  try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
  return true;
}
window.badgeApply = badgeApply;
(window._after ||= []).push(() => { if (!me) return; const n = badgeCount(); window._badgeN = n; if (!DEMO) badgeApply(n); });
