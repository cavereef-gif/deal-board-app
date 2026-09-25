// Deal Board v17 prototype — New task sheet with due dates, "Due" on every task, the "Whose chat?" picker,
// demo-mode actions on the sample data, and typing mode (bottom bar hides while typing).

// ---------- New task sheet ----------
let tsKind = "own", tsOwner = "Chris", tsDue = "";
function tsPaint() {
  document.querySelectorAll("#taskSheet [data-tk]").forEach(b => b.classList.toggle("on", b.dataset.tk === tsKind));
  document.querySelectorAll("#taskSheet [data-towner]").forEach(b => b.classList.toggle("on", b.dataset.towner === tsOwner));
  document.querySelectorAll("#taskSheet [data-tdue]").forEach(b => b.classList.toggle("on", b.dataset.tdue === tsDue));
  $("tsFromBox").classList.toggle("hidden", tsKind !== "wait");
  $("tsWhatL").textContent = tsKind === "wait" ? "What are we waiting for?" : "What needs doing?";
  $("tsWhat").placeholder = tsKind === "wait" ? "e.g. Permits" : "e.g. Send the truck list";
  $("tsDateBox").classList.toggle("hidden", tsDue !== "pick");
}
function openTaskSheet(opts) {
  opts = opts || {};
  tsKind = opts.kind || "own"; tsOwner = me === "Annemarie" ? "Annemarie" : "Chris"; tsDue = "";
  ["tsWhat", "tsFrom", "tsBlocks", "tsNext", "tsDate"].forEach(id => { $(id).value = ""; });
  $("tsUrgent").checked = false; $("tsMsg").textContent = "";
  $("tsDeal").innerHTML = `<option value="">No deal</option>` + liveDeals().map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
  $("tsDeal").value = opts.deal && dealById(opts.deal) ? opts.deal : "";
  const d = dealById($("tsDeal").value); $("tsArea").value = d && PROJECTS.includes(d.area) ? d.area : "Transport";
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
});
$("tsDeal").addEventListener("change", () => { const d = dealById($("tsDeal").value); if (d && PROJECTS.includes(d.area)) $("tsArea").value = d.area; });
$("tsAdd").onclick = async () => {
  const what = $("tsWhat").value.trim(), from = $("tsFrom").value.trim();
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
  const set = !!it.due_on;
  return `<div class="duerow"><div class="dr-t">${set ? "Due " + dayWords(dueDate(it)) : `No due date – chase ${dayWords(dueDate(it))}`}</div><div class="dr-b">
    <button type="button" data-a="due" data-v="${saDayPlus(0)}">Today</button><button type="button" data-a="due" data-v="${saDayPlus(1)}">Tomorrow</button>
    <label class="datepick"><span>Pick a date</span><input type="date" data-duepick="${it.id}" value="${esc(it.due_on || "")}" aria-label="Pick a due date"></label>
    ${set ? `<button type="button" data-a="due" data-v="">No date</button>` : ""}</div></div>`;
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
