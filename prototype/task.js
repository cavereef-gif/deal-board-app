// Deal Board v17 prototype — New task sheet with due dates, "Due" on every task, the "Whose chat?" picker,
// demo-mode actions on the sample data, and typing mode (bottom bar hides while typing).

// ---------- New task sheet ----------
let tsKind = "own", tsOwner = "Chris", tsDue = "";
// ---------- quick words in the task line (Ion Rail "New job", 27 Sep 2026) ----------
// Type it once: "Chase Adrian for tippers fri @annemarie #pmc" lands on Friday, for Annemarie, on the deal with "pmc" in its name.
const TS_DAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
function tsParse(text) {
  const out = { clean: [], due: null, owner: null, from: null, deal: null, urgent: false, toks: [] };
  const today = new Date(saDayPlus(0) + "T08:00:00+02:00").getUTCDay();
  for (const w of String(text || "").split(/\s+/).filter(Boolean)) {
    const lw = w.toLowerCase().replace(/[.,;:]$/, "");
    if (/^(today|tod)$/.test(lw)) { out.due = saDayPlus(0); out.toks.push(["day", "Today"]); continue; }
    if (/^(tmrw|tmr|tomorrow|tomorow)$/.test(lw)) { out.due = saDayPlus(1); out.toks.push(["day", "Tomorrow"]); continue; }
    if (lw in TS_DAYS) { const n = (TS_DAYS[lw] - today + 7) % 7; out.due = saDayPlus(n); out.toks.push(["day", n === 0 ? "Today" : dayName(new Date(out.due + "T08:00:00+02:00"))]); continue; }
    if (/^@[a-z]/i.test(w) && w.length > 2) {
      const n = w.slice(1).replace(/[.,;:]$/, "");
      if (/^(chris|me)$/i.test(n)) { out.owner = "Chris"; out.toks.push(["who", "Chris"]); }
      else if (/^(annemarie|am|anne)$/i.test(n)) { out.owner = "Annemarie"; out.toks.push(["who", "Annemarie"]); }
      else { out.from = n.charAt(0).toUpperCase() + n.slice(1); out.toks.push(["from", "Waiting on " + out.from]); }
      continue;
    }
    if (/^#\w/.test(w) && w.length > 2 && typeof liveDeals === "function") {
      const q = w.slice(1).toLowerCase(), d = liveDeals().find(x => x.name.toLowerCase().includes(q));
      if (d) { out.deal = d.id; out.toks.push(["deal", d.name]); continue; }
    }
    if (w === "!" || lw === "urgent") { out.urgent = true; out.toks.push(["urg", "Urgent"]); continue; }
    out.clean.push(w);
  }
  out.clean = out.clean.join(" ");
  return out;
}
function tsApplyWords() {
  const p = tsParse($("tsWhat").value);
  if (p.due) { tsDue = "pick"; $("tsDate").value = p.due; }
  if (p.owner) tsOwner = p.owner;
  if (p.from) { tsKind = "wait"; $("tsFrom").value = p.from; }
  if (p.deal) { $("tsDeal").value = p.deal; const d = dealById(p.deal); if (d && [...$("tsArea").options].some(o => o.value === d.area)) $("tsArea").value = d.area; }
  if (p.urgent) $("tsUrgent").checked = true;
  $("tsToks").innerHTML = p.toks.map(([k, t]) => `<span class="tok t-${k}">${esc(t)}</span>`).join("");
  tsPaint(true);
}
// the week as a rail: seven days, how many jobs each already has, and where this one lands (tap a day to move it)
function tsWeekHtml() {
  const key = tsDue === "pick" ? $("tsDate").value : tsDue === "" ? "" : saDayPlus(+tsDue);
  const cnt = {}; for (const it of (window._items || [])) { const d = it.due_on || (typeof dueDate === "function" && dueDate(it) ? saKey(dueDate(it)) : ""); if (d) cnt[d] = (cnt[d] || 0) + 1; }
  const what = tsParse($("tsWhat").value).clean || "This job", dn = dealById($("tsDeal").value);
  const rows = [...Array(7)].map((_, i) => { const k = saDayPlus(i), d = new Date(k + "T08:00:00+02:00"), on = k === key, n = cnt[k] || 0;
    return `<button type="button" class="twr${on ? " on" : ""}" data-tday="${k}" aria-pressed="${on}"><span class="twd"><span>${i === 0 ? "Today" : WDAY[d.getUTCDay()] + " " + d.getUTCDate()}</span><span class="twn">${n ? n + " job" + (n > 1 ? "s" : "") : "–"}</span></span><i class="twk" aria-hidden="true"></i>${on ? `<span class="twc"><span class="twt">${esc(what)}</span><span class="tws">${esc([tsKind === "wait" && $("tsFrom").value ? "Waiting on " + $("tsFrom").value : tsOwner, dn ? dn.name : ""].filter(Boolean).join(" · "))}</span></span>` : ""}</button>`; }).join("");
  const later = key && !rows.includes(`data-tday="${key}" `) && ![...Array(7)].some((_, i) => saDayPlus(i) === key);
  return `<div class="rread rin"><span>rail · this week</span><span>${later ? "due " + esc(dayName(new Date(key + "T08:00:00+02:00"))) : key ? "tap a day" : "no date yet"}</span></div><div class="twrail">${rows}</div>`;
}
function tsPaint(fromWords) {
  document.querySelectorAll("#taskSheet [data-tk]").forEach(b => b.classList.toggle("on", b.dataset.tk === tsKind));
  document.querySelectorAll("#taskSheet [data-towner]").forEach(b => b.classList.toggle("on", b.dataset.towner === tsOwner));
  document.querySelectorAll("#taskSheet [data-tdue]").forEach(b => b.classList.toggle("on", b.dataset.tdue === tsDue));
  $("tsFromBox").classList.toggle("hidden", tsKind !== "wait");
  $("tsWhatL").textContent = tsKind === "wait" ? "What are we waiting for?" : "What needs doing?";
  $("tsWhat").placeholder = tsKind === "wait" ? "e.g. Permits" : "e.g. Send the truck list";
  $("tsDateBox").classList.toggle("hidden", tsDue !== "pick");
  const wk = $("tsWeek"); if (wk) wk.innerHTML = tsWeekHtml();
  if (!fromWords && $("tsToks")) $("tsToks").innerHTML = tsParse($("tsWhat").value).toks.map(([k, t]) => `<span class="tok t-${k}">${esc(t)}</span>`).join("");
}
$("tsWhat").addEventListener("input", tsApplyWords);
$("tsDate").addEventListener("change", () => tsPaint());
$("tsFrom").addEventListener("input", () => tsPaint());
function openTaskSheet(opts) {
  opts = opts || {};
  tsKind = opts.kind || "own"; tsOwner = me === "Annemarie" ? "Annemarie" : "Chris"; tsDue = "";
  ["tsWhat", "tsFrom", "tsBlocks", "tsNext", "tsDate"].forEach(id => { $(id).value = ""; });
  $("tsUrgent").checked = false; $("tsMsg").textContent = "";
  $("tsDeal").innerHTML = `<option value="">No deal</option>` + liveDeals().map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("") + `<option value="__newdeal">+ New deal…</option>`;
  $("tsDeal").value = opts.deal && dealById(opts.deal) ? opts.deal : "";
  // Area list = the fixed areas plus any added section; it starts on the deal's section, else the section being viewed
  const areas = [...new Set([...PROJECTS, ...(window.sectionsList ? sectionsList() : [])])];
  $("tsArea").innerHTML = areas.map(a => `<option>${esc(a)}</option>`).join("");
  const d = dealById($("tsDeal").value), cur = typeof section !== "undefined" && section !== "All" ? section : "";
  $("tsArea").value = d && areas.includes(d.area) ? d.area : cur && areas.includes(cur) ? cur : "Transport";
  document.querySelector("#taskSheet .tsmore").open = !!opts.deal;
  const sb0 = document.querySelector("#taskSheet .seenbox"); if (sb0) sb0.innerHTML = "";
  tsPaint();
  $("taskSheet").classList.remove("hidden");
  setTimeout(() => $("tsWhat").focus(), 60);
}
window.openTaskSheet = openTaskSheet;
const closeTaskSheet = () => $("taskSheet").classList.add("hidden");
$("tsClose").onclick = closeTaskSheet;
$("taskSheet").addEventListener("click", e => {
  if (e.target.id === "taskSheet") { closeTaskSheet(); return; }
  const k = e.target.closest("[data-tk]"); if (k) { tsKind = k.dataset.tk; tsPaint(); (tsKind === "wait" ? $("tsFrom") : $("tsWhat")).focus(); return; }
  const o = e.target.closest("[data-towner]"); if (o) { tsOwner = o.dataset.towner; tsPaint(); return; }
  const d = e.target.closest("[data-tdue]"); if (d) { tsDue = d.dataset.tdue; tsPaint(); if (tsDue === "pick") $("tsDate").focus(); return; }
  const wd = e.target.closest("[data-tday]"); if (wd) { tsDue = "pick"; $("tsDate").value = wd.dataset.tday; tsPaint(); return; }
});
$("tsDeal").addEventListener("change", () => { tsPaint(); const d = dealById($("tsDeal").value); if (d && [...$("tsArea").options].some(o => o.value === d.area)) $("tsArea").value = d.area; });
$("tsAdd").onclick = async () => {
  const what = tsParse($("tsWhat").value).clean.trim(), from = $("tsFrom").value.trim();
  if (!what) { $("tsMsg").textContent = "Type what needs doing first."; $("tsWhat").focus(); return; }
  if (tsKind === "wait" && !from) { $("tsMsg").textContent = "Type who we are waiting on."; $("tsFrom").focus(); return; }
  const due = tsDue === "" ? null : tsDue === "pick" ? ($("tsDate").value || null) : saDayPlus(+tsDue);
  if (tsDue === "pick" && !due) { $("tsMsg").textContent = "Pick a date, or choose No date."; return; }
  const ownWords = /^(me|us|ours|chris|annemarie|chris (&|and) annemarie)$/i;
  const waitingOn = tsKind === "own" || ownWords.test(from) ? "Me" : from;
  const body = { p_project: $("tsArea").value, p_waiting_on: waitingOn, p_waiting_for: what, p_blocks: $("tsBlocks").value.trim(), p_next: $("tsNext").value.trim(),
    p_priority: $("tsUrgent").checked ? 1 : 2, p_owner: tsOwner, p_deal: $("tsDeal").value || null, p_due: due };
  if (DEMO) {
    const now = new Date().toISOString();
    const it = { id: "n" + Date.now(), project: body.p_project, deal_id: body.p_deal, waiting_on: waitingOn, waiting_for: what, blocks: body.p_blocks, next_action: body.p_next,
      state: "Confirmed", priority: body.p_priority, owner: tsOwner, nudge_after_days: 3, last_chased: now, created_at: now, due_on: due };
    it._days = 0; it._me = isMe(it); it._stale = it.due_on ? dayDiff(dueDate(it)) < 0 : false;
    (window._items ||= []).push(it); closeTaskSheet(); toast("Added (demo – not saved)."); render(); return;
  }
  $("tsAdd").disabled = true; $("tsMsg").textContent = "Saving…";
  let { error } = await sb.rpc("add_item", body);
  if (error && /p_due|function/i.test(error.message)) { const b2 = { ...body }; delete b2.p_due; ({ error } = await sb.rpc("add_item", b2)); if (!error && due) toast("Saved without the due date (the database is not updated yet)."); }
  $("tsAdd").disabled = false;
  if (error) { $("tsMsg").textContent = "Could not save: " + error.message; return; }
  closeTaskSheet(); toast(`Added for ${tsOwner}.`); load();
};

// ---------- "Due" on a task (in the task sheet) ----------
function dueRowHtml(it) {
  const d = it.due_on || "", t0 = saDayPlus(0), t1 = saDayPlus(1), other = d && d !== t0 && d !== t1;
  const b = (v, label) => `<button type="button"${d === v ? ' class="on" aria-pressed="true"' : ` data-a="due" data-v="${v}" aria-pressed="false"`}>${label}</button>`;
  return `<div class="lbl">Due</div><div class="seg2 dr-b" role="group" aria-label="Due">${b("", "No date")}${b(t0, "Today")}${b(t1, "Tomorrow")}
    <label class="datepick${other ? " on" : ""}"><span>${other ? esc(dayName(dueDate(it))) : "Pick date"}</span><input type="date" data-duepick="${it.id}" value="${esc(d)}" aria-label="Pick a due date"></label></div>
    <div class="dr-t">${d ? "Due " + dayWords(dueDate(it)) : dayDiff(dueDate(it)) < 0 ? `No due date – the chase was due ${dayWords(dueDate(it))}` : `No due date – we chase it ${dayWords(dueDate(it))}`}</div>`;
}
window.dueRowHtml = dueRowHtml;
$("list").addEventListener("change", async e => {
  const el = e.target.closest("input[data-duepick]"); if (!el || !el.value) return;
  if (DEMO) { demoItemAction(el.dataset.duepick, "due", el.value); return; }
  const { error } = await sb.rpc("item_action", { p_id: el.dataset.duepick, p_action: "due", p_value: el.value });
  if (error) { toast("Could not save: " + error.message, 6000); return; }
  toast("Due date saved."); load();
});

// ---------- Demo mode: task buttons work on the sample data (nothing is saved) ----------
function demoItemAction(id, a, v) {
  const it = (window._items || []).find(i => i.id === id); if (!it) return;
  if (a === "assign") it.owner = v;
  else if (a === "confirm") it.state = "Confirmed";
  else if (a === "done" || a === "drop") { window._items = window._items.filter(i => i !== it); window._sheetItem = null; }
  else if (a === "chased") it.last_chased = new Date().toISOString();
  else if (a === "priority") it.priority = +v;
  else if (a === "due") it.due_on = v || null;
  else { toast("Demo – nothing saved."); return; }
  it._days = daysSince(it.last_chased || it.created_at);
  it._stale = it.due_on ? dayDiff(dueDate(it)) < 0 : it._days >= (it.nudge_after_days || 3);
  toast(a === "done" ? "Done (demo – not saved)." : a === "drop" ? "Dropped (demo – not saved)." : "Changed (demo – not saved).");
  render();
}
window.demoItemAction = demoItemAction;

// ---------- "Whose WhatsApp chat?" picker (from + → WhatsApp chat) ----------
function pickResults(q) {
  q = (q || "").trim().toLowerCase();
  const has = s => !q || String(s || "").toLowerCase().includes(q);
  const out = [];
  (window._contacts || []).filter(c => has(c.name + " " + c.company + " " + c.phone)).slice(0, 8).forEach(c => out.push(["contact:" + c.id, c.name, ["Saved contact", c.company].filter(Boolean).join(" · ")]));
  liveDeals().filter(d => has(d.name)).slice(0, 6).forEach(d => out.push(["deal:" + d.id, d.name, "Deal"]));
  if (q.length >= 2) (window._leads || []).filter(l => has(l.name + " " + l.person)).slice(0, 10).forEach(l => out.push(["lead:" + l.id, l.name, ["Buyer / supplier list", l.country].filter(Boolean).join(" · ")]));
  return out;
}
function paintPick() {
  const r = pickResults($("pkQ").value);
  $("pkRes").innerHTML = r.map(([t, n, sub]) => `<button type="button" class="pkrow" data-pick="${esc(t)}"><span class="pk-n">${esc(n)}</span><span class="pk-s">${esc(sub)}</span></button>`).join("")
    || `<div class="quiet">No match. Save the person as a contact first (+ → New contact), then add the chat.</div>`;
}
function openPickSheet() { $("pkQ").value = ""; paintPick(); $("pickSheet").classList.remove("hidden"); setTimeout(() => $("pkQ").focus(), 60); }
window.openPickSheet = openPickSheet;
$("pkClose").onclick = () => $("pickSheet").classList.add("hidden");
$("pkQ").addEventListener("input", paintPick);
$("pickSheet").addEventListener("click", e => {
  if (e.target.id === "pickSheet") { $("pickSheet").classList.add("hidden"); return; }
  const b = e.target.closest("[data-pick]"); if (!b) return;
  $("pickSheet").classList.add("hidden");
  if (window.startChatImport) startChatImport(b.dataset.pick);
});

// ---------- Typing mode: hide the bottom bar while typing so the box sits above the keyboard ----------
const typingEl = el => el && el.matches && el.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]), textarea");
// Only while the on-screen keyboard is actually open (the visible area shrinks), so closing the keyboard always brings the bar back.
function updTyping() {
  const focused = typingEl(document.activeElement);
  const vv = window.visualViewport, kb = vv ? (window.innerHeight - vv.height) > 120 : false;
  document.body.classList.toggle("typing", !!(focused && kb));
}
document.addEventListener("focusin", () => setTimeout(updTyping, 250));
document.addEventListener("focusout", () => setTimeout(updTyping, 150));
if (window.visualViewport) visualViewport.addEventListener("resize", updTyping);
