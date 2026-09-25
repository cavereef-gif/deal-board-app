// Deal Board v12 — Today page: clear numbered sections, one tappable line per task, each line opens where the work gets done.
// WhatsApp drafts from the brief live on their item / deal / lead, not on this page.
function parseBrief(b) {
  if (!b || !b.text) return null;
  try { const j = JSON.parse(b.text); if (j && j.v === 2) return j; } catch (e) {}
  return { v: 1, summary: "", legacy: b.text, risks: [], chase_order: [] };
}
const draftsFor = (type, id) => (window._drafts || []).filter(d => d[type + "_id"] === id);
window.draftsFor = draftsFor;
function draftHtml(type, id, num) {
  const d = draftsFor(type, id)[0]; if (!d) return "";
  return `<div class="draft"><div class="dl">WhatsApp draft${d.old_value ? " " + esc(d.old_value) : ""} · bot, ${fmtDay(d.changed_at)}</div><div class="dt">${esc(d.new_value)}</div>
    <div class="acts0">${num ? `<button class="primary" data-wadraft="${esc(num)}" data-draft="${d.id}">Send on WhatsApp</button>` : `<span class="quiet">No number saved – add one on the contact card.</span>`}<button data-copydraft="${d.id}">Copy</button></div></div>`;
}
window.draftHtml = draftHtml;

function tRow(o) {
  // o: {go, dot, title, sub, right, open, body, rail}
  return `<div class="trow${o.open ? " open" : ""}${o.rail ? " " + o.rail : ""}"><button class="tgo" data-tgo="${esc(o.go)}" aria-expanded="${!!o.open}"><i class="dot" style="background:${o.dot}"></i><span class="tx"><span class="tt1">${o.title}</span>${o.sub ? `<span class="ts">${o.sub}</span>` : ""}</span>${o.right ? `<span class="tr">${o.right}</span>` : ""}<span class="chev">${o.open ? "▾" : "›"}</span></button>${o.open && o.body ? `<div class="tbody">${o.body}</div>` : ""}</div>`;
}
function tSection(n, key, title, hint, rows, dflt) {
  const k = "today:" + key, open = isOpen(k, dflt !== false);
  return `<section class="tsec"><button class="tsh" data-tog="${k}" data-dflt="${dflt === false ? 0 : 1}" aria-expanded="${open}"><span class="tn">${n}</span><span class="th"><span class="tht">${title}</span><span class="ths">${hint}</span></span><span class="tc">${rows.length}</span><span class="chev">${open ? "▾" : "▸"}</span></button>${open ? `<div class="tlist">${rows.join("") || `<div class="quiet" style="padding:10px 14px">Nothing here.</div>`}</div>` : ""}</section>`;
}
const DOT = { high: "#C45C5C", stale: "#D9A03F", ok: "#4FA88A", prop: "#8A8A92", blue: "#5C7FB8" };

function itemRow(it, why) {
  const k = "ti:" + it.id, open = isOpen(k, false);
  const who = it._me ? "" : esc(it.waiting_on) + ": ";
  const sub = [why, it.next_action ? "Next: " + esc(it.next_action) : "", it.blocks ? "Blocks " + esc(it.blocks) : ""].filter(Boolean).join(" · ");
  const hasDraft = draftsFor("item", it.id).length;
  return tRow({ go: "item:" + it.id, dot: it.state === "Proposed" ? DOT.prop : it.priority === 1 ? DOT.high : it._stale ? DOT.stale : DOT.ok, rail: "p" + (it.priority || 2),
    title: who + esc(it.waiting_for), sub: sub + (hasDraft ? `${sub ? " · " : ""}WhatsApp draft ready` : ""), right: `${it._days}d`, open, body: rowHtml(it, 0) });
}

function todayHtml(items) {
  const target = who || me || "Chris";
  const mine = items.filter(i => who === "All" || (i.owner || "Chris") === target);
  const br = parseBrief(window._brief);
  const order = (br && br.chase_order) || [];
  const rank = it => { const i = order.indexOf(it.id); return i < 0 ? 999 : i; };
  // Chase = everyone we wait on who is due (or the bot put first), confirmed or still proposed
  const chase = mine.filter(i => !i._me && (order.includes(i.id) || (i._stale && i.state !== "Proposed"))).sort((a, b) => rank(a) - rank(b) || byPrioThenAge(a, b));
  const ours = mine.filter(i => i._me).sort(byPrioThenAge);
  const proposed = mine.filter(i => i.state === "Proposed" && !chase.includes(i) && !ours.includes(i)).sort(byPrioThenAge);
  const waiting = mine.filter(i => !i._me && i.state !== "Proposed" && !chase.includes(i)).sort(byPrioThenAge);
  const td = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  const gOpen = k => ((window._gates || []).find(g => g.key === k) || {}).status === "open";
  const queue = (window._ltasks || []).filter(t => t.status === "open" && !(t.gates || []).some(gOpen) && (!t.not_before || t.not_before <= td)).sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, 5);
  const deals = liveDeals().map(d => ({ d, pg: dealProgress(d.id) })).filter(x => x.pg.next || x.d.next_milestone);

  const chips = ["Mine", "Annemarie", "Chris", "All"].filter(c => c !== me).map(c => `<button data-who="${c === "Mine" ? "" : c}" class="${(c === "Mine" && !who) || who === c ? "on" : ""}">${c}</button>`).join("");
  const dayStr = new Date().toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long" });
  let h = `<div class="thead"><div class="tdate">${dayStr}</div>
    <div class="tsum">${br && br.summary ? esc(br.summary) : br && br.legacy ? "Older brief – tap Refresh for the new tappable version." : "No brief yet today."}</div>
    <div class="acts0"><button data-bot="brief-here">${botBusy ? "Working…" : br ? "Refresh brief" : "Get brief"}</button><button data-emailbrief="1">Email me today</button></div>
    <div class="chips" style="margin:10px 0 0">${chips}</div></div>`;

  let n = 0;
  const prop = it => it.state === "Proposed" ? " · not confirmed yet" : "";
  h += tSection(++n, "chase", "Chase today", "Waiting on other people – most urgent first", chase.map(it => itemRow(it, `${it._days} days since last asked${prop(it)}`)));
  h += tSection(++n, "ours", "Our own tasks", "Things only we can do", ours.map(it => itemRow(it, `${it._days} days open${prop(it)}`)));
  if (proposed.length) h += tSection(++n, "confirm", "To confirm", "Proposed – tap, then OK keep or Drop", proposed.map(it => itemRow(it, "Proposed")));
  h += tSection(++n, "deals", "Deals – next step", "Tap to open the deal at that step", deals.map(({ d, pg }) => tRow({ go: "deal:" + d.id + (pg.next ? ":" + pg.next.id : ""), dot: d.status === "On hold" ? DOT.prop : DOT.blue,
    title: esc(d.name), sub: pg.next ? `${esc(pg.cur.name)} · next: ${esc(pg.next.title)} · ${pg.done}/${pg.total} ticked` : "Next: " + esc(d.next_milestone), right: "" })));
  if (queue.length) h += tSection(++n, "buyers", "Buyer search – next up", "Top of the scored queue; tap to open the lead", queue.map(t => {
    const ls = (t.lead_ids || []).map(id => (window._leads || []).find(l => l.id === id)).filter(Boolean);
    return tRow({ go: ls.length === 1 ? "lead:" + ls[0].id : "task:" + t.id, dot: DOT.ok, title: esc(t.task), sub: `Score ${t.score}${t.kind ? " · " + esc(t.kind) : ""}${ls.length > 1 ? ` · ${ls.length} leads` : ""}`, right: "" });
  }));
  const risks = (br && br.risks) || [];
  const refName = r => r.ref_type === "item" ? (((window._items || []).find(i => i.id === r.ref_id) || {}).waiting_for || "") : r.ref_type === "deal" ? ((dealById(r.ref_id) || {}).name || "") : r.ref_type === "lead" ? (((window._leads || []).find(l => l.id === r.ref_id) || {}).name || "") : "";
  if (risks.length) h += tSection(++n, "risks", "Risks to check", "Spotted by the bot – tap to see where", risks.map(r => (r.ref_type && r.ref_id && refName(r))
    ? tRow({ go: r.ref_type + ":" + r.ref_id, dot: DOT.high, title: esc(r.text), sub: "On: " + esc(refName(r)), right: "" })
    : `<div class="tline"><i class="dot" style="background:${DOT.high};margin-right:8px"></i>${esc(r.text)}</div>`));
  if (br && br.legacy) h += tSection(++n, "old", "Older brief (plain text)", "Refresh to get the tappable version", br.legacy.split(/\n+/).filter(Boolean).map(l => `<div class="tline">${esc(l)}</div>`), false);
  h += tSection(++n, "waiting", "Waiting – not due yet", "No chase needed today", waiting.map(it => itemRow(it, `${it._days} of ${it.nudge_after_days || 3} days`)), false);
  if (!items.length) h += `<div class="empty">Nothing open. Tap + Add.</div>`;
  return h;
}
window.todayHtml = todayHtml;

function briefAsText() {
  const br = parseBrief(window._brief);
  const target = who || me || "Chris";
  const items = (window._items || []).filter(i => who === "All" || (i.owner || "Chris") === target);
  const lines = [];
  if (br && br.summary) lines.push(br.summary, "");
  const ord = (br && br.chase_order) || [];
  const chase = items.filter(i => !i._me && (ord.includes(i.id) || (i._stale && i.state !== "Proposed"))).sort((a, b) => ((ord.indexOf(a.id) + 1) || 999) - ((ord.indexOf(b.id) + 1) || 999) || byPrioThenAge(a, b));
  if (chase.length) lines.push("CHASE TODAY", ...chase.map((i, n) => `${n + 1}. ${i.waiting_on}: ${i.waiting_for} (${i._days}d)${i.next_action ? " – next: " + i.next_action : ""}`), "");
  const ours = items.filter(i => i._me).sort(byPrioThenAge);
  if (ours.length) lines.push("OUR OWN TASKS", ...ours.map((i, n) => `${n + 1}. ${i.waiting_for}`), "");
  const prop = items.filter(i => i.state === "Proposed" && !chase.includes(i) && !ours.includes(i));
  if (prop.length) lines.push("TO CONFIRM", ...prop.map((i, n) => `${n + 1}. ${i.waiting_on}: ${i.waiting_for}`), "");
  const deals = liveDeals().map(d => ({ d, pg: dealProgress(d.id) })).filter(x => x.pg.next);
  if (deals.length) lines.push("DEALS – NEXT STEP", ...deals.map(({ d, pg }, n) => `${n + 1}. ${d.name}: ${pg.cur.name} – ${pg.next.title}`), "");
  if (br && br.risks && br.risks.length) lines.push("RISKS TO CHECK", ...br.risks.map((r, n) => `${n + 1}. ${r.text}`), "");
  lines.push("Open the board: " + location.origin + location.pathname);
  return lines.join("\n");
}
window.briefAsText = briefAsText;

// Tap a line: open the place where the work gets done
function goTo(ref) {
  const [type, id, extra] = ref.split(":");
  const scrollTo = sel => setTimeout(() => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 30);
  if (type === "item") {
    if (view === "worklist" && document.querySelector(`[data-tgo="item:${id}"]`)) { toggleKey("ti:" + id, false); render(); return; }
    const it = (window._items || []).find(i => i.id === id); if (!it) { toast("That item is closed or gone."); return; }
    view = "worklist"; openKeys.delete("-ti:" + id); openKeys.add("+ti:" + id); saveOpen(); render(); scrollTo(`[data-tgo="item:${id}"]`); return;
  }
  if (type === "deal") {
    const d = dealById(id); if (!d) { toast("That deal is not on the board."); return; }
    view = "deals"; try { localStorage.setItem("view", view); } catch (e) {}
    if (dealFilter === "Closed" && (d.status === "Active" || d.status === "On hold")) dealFilter = "Active";
    openKeys.delete("-deal:" + id); openKeys.add("+deal:" + id);
    if (extra) { const st = (window._steps || []).find(s => s.id === extra); if (st) { openKeys.delete(`-sec:${id}:check`); openKeys.add(`+stage:${id}:${st.stage}`); openStep = st.id; } }
    saveOpen(); render(); scrollTo(extra ? `[data-step="${extra}"]` : `.deal[data-deal="${id}"]`); return;
  }
  if (type === "lead") {
    const l = (window._leads || []).find(x => x.id === id); if (!l) { toast("That lead is not in the directory."); return; }
    view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    dSeg = "all"; dStat = "any"; dCountry = ""; dQ = l.name; dOpen = l.id; render(); scrollTo(`#lead-${id}`); return;
  }
  if (type === "task") {
    view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    openKeys.delete("-dq"); dTaskDone = id; render();
    const inTop = document.querySelector(`[data-dtaskact="${id}"]`);
    if (!inTop) { openKeys.add("+dq:more"); openKeys.add("+dq:gated"); openKeys.add("+dq:later"); saveOpen(); render(); }
    scrollTo("#tOut"); return;
  }
  if (type === "contact") { view = "people"; openPanels.add("contact:" + id); render(); scrollTo(`.ccard[data-cid="${id}"]`); return; }
}
window.goTo = goTo;

$("list").addEventListener("click", async e => {
  const g = e.target.closest("button[data-tgo]"); if (g) { goTo(g.dataset.tgo); return; }
  const w = e.target.closest("button[data-wadraft]");
  if (w) { const d = (window._drafts || []).find(x => String(x.id) === w.dataset.draft); location.href = `https://wa.me/${w.dataset.wadraft}?text=` + encodeURIComponent(d ? d.new_value : ""); return; }
  const c = e.target.closest("button[data-copydraft]");
  if (c) { const d = (window._drafts || []).find(x => String(x.id) === c.dataset.copydraft); try { await navigator.clipboard.writeText(d ? d.new_value : ""); toast("Copied."); } catch (er) { toast("Copy not allowed here – long-press the text."); } return; }
});
