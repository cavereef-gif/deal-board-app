// Deal Board v16 — Home: greeting, focus cards, progress rings, deal tiles, week schedule; tapping any task opens it in a sheet.
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
    <div class="acts0">${num ? `<button class="primary" data-wadraft="${esc(num)}" data-draft="${d.id}">${ic("chat")}Send on WhatsApp</button>` : `<span class="quiet">No number saved – add one on the contact card.</span>`}${ib("copy", "file", `data-copydraft="${d.id}"`, "Copy the draft")}</div></div>`;
}
window.draftHtml = draftHtml;

function tRow(o) {
  // o: {go, dot, title, sub, right, open, body, rail}
  return `<div class="trow${o.open ? " open" : ""}${o.rail ? " " + o.rail : ""}"><button class="tgo" data-tgo="${esc(o.go)}" aria-expanded="${!!o.open}"><i class="dot" style="background:${o.dot}"></i><span class="tx"><span class="tt1">${o.title}</span>${o.sub ? `<span class="ts">${o.sub}</span>` : ""}</span>${o.right ? `<span class="tr">${o.right}</span>` : ""}<span class="chev"></span></button>${o.open && o.body ? `<div class="tbody">${o.body}</div>` : ""}</div>`;
}
function tSection(n, key, title, hint, rows, dflt) {
  const k = "today:" + key, open = isOpen(k, dflt !== false);
  return `<section class="tsec" id="tsec-${key}"><button class="tsh" data-tog="${k}" data-dflt="${dflt === false ? 0 : 1}" aria-expanded="${open}"><span class="tn">${n}</span><span class="th"><span class="tht">${title}</span><span class="ths">${hint}</span></span><span class="tc">${rows.length}</span><span class="chev"></span></button>${open ? `<div class="tlist">${rows.join("") || `<div class="quiet" style="padding:10px 14px">Nothing here.</div>`}</div>` : ""}</section>`;
}
const DOT = { high: "var(--bad)", stale: "var(--warn)", ok: "var(--ok)", prop: "var(--prop)", blue: "var(--accent)" };

function itemRow(it, why) {
  const k = "ti:" + it.id, open = isOpen(k, false);
  const who = it._me ? "" : esc(it.waiting_on) + ": ";
  const sub = [why, sinceWords(it), it.next_action ? "Next: " + esc(it.next_action) : "", it.blocks ? "Blocks " + esc(it.blocks) : ""].filter(Boolean).join(" · ");
  const hasDraft = draftsFor("item", it.id).length;
  return tRow({ go: "item:" + it.id, dot: it.state === "Proposed" ? DOT.prop : it.priority === 1 ? DOT.high : it._stale ? DOT.stale : DOT.ok, rail: "p" + (it.priority || 2),
    title: who + esc(it.waiting_for), sub: sub + (hasDraft ? `${sub ? " · " : ""}WhatsApp draft ready` : ""), right: it.state === "Proposed" ? "" : dueWords(it), open, body: rowHtml(it, 0) });
}

// ---------- Home: one to-do list (Overdue · Today · Tomorrow · This week · Later), then next steps on deals and buyer search, then an overview ----------
const SA = () => new Date(Date.now() + 2 * 3600e3);
const saKey = d => new Date(new Date(d).getTime() + 2 * 3600e3).toISOString().slice(0, 10);
function dueOf(it) { return dueDate(it); }
function ringsSvg(vals) {
  const R = [52, 41, 30], cols = ["url(#velvetGrad)", "#FF7BBF", "#5FD9C9"];
  return `<svg class="rings" viewBox="0 0 128 128" aria-hidden="true">${R.map((r, i) => { const c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, vals[i] || 0)); return `<circle cx="64" cy="64" r="${r}" class="bg"/><circle cx="64" cy="64" r="${r}" stroke="${cols[i]}" stroke-dasharray="${(p * c).toFixed(1)} ${c.toFixed(1)}"${p === 0 ? ' stroke-opacity="0"' : ""}/>`; }).join("")}</svg>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function dtile(d) {
  const pg = dealProgress(d.id), waits = itemsOf(d.id);
  const owners = [...new Set(waits.map(i => i.owner || "Chris"))];
  const kindIc = d.kind === "transport" ? ["truck", "#72A9FF"] : d.kind === "mineral" ? ["gem", "#C7B6FF"] : ["deals", "#F0C05A"];
  const av = owners.map(o => `<span style="background:${o === "Annemarie" ? "#FF9CCB" : "#C7B6FF"}" title="${esc(o)}">${esc(o[0])}</span>`).join("");
  return `<button class="dtile" data-tgo="deal:${d.id}"><span class="dt-top"><span class="dt-ic" style="--c:${kindIc[1]}">${ic(kindIc[0])}</span><span class="avs">${av}</span></span><span class="dt-n">${esc(d.name)}</span><span class="dt-p"><span class="pbar"><i style="width:${pct(pg.done, pg.total)}%"></i></span><span class="dt-c">${pg.done} of ${pg.total}</span></span></button>`;
}
// One task = one line (what) + one line of plain words (kind · due · who). Suggestions carry Accept / Drop.
function homeRow(it, showOwner, noWho) {
  const sugg = it.state === "Proposed", n = dayDiff(dueDate(it)), dw = dueWords(it);
  const rail = n < 0 ? " r-warn" : sugg ? " r-prop" : it.priority === 1 ? " r-bad" : "";
  const meta = [kindWords(it), it.priority === 1 ? "Urgent" : "", sugg ? sinceWords(it) : it._me ? dw : `${dw} · ${sinceWords(it)}`, showOwner ? (it.owner || "Chris") : ""].filter(Boolean).join(" · ");
  return `<div class="hrow${rail}"><button class="hr-main" data-tgo="item:${it.id}"><span class="hr-t">${it._me || noWho ? "" : esc(it.waiting_on) + ": "}${esc(it.waiting_for)}</span><span class="hr-m">${meta}</span></button></div>`;
}
function linkRow(go, title, meta, rail) {
  return `<div class="hrow${rail ? " " + rail : ""}"><button class="hr-main" data-tgo="${esc(go)}"><span class="hr-t">${title}</span><span class="hr-m">${meta}</span></button></div>`;
}
function hLabel(title, rows) {
  if (!rows.length) return "";
  return `<section class="hgrp"><div class="hg-l"><span>${title}</span><span class="hg-c">${rows.length}</span></div><div class="hg-b">${rows.join("")}</div></section>`;
}
function hGroup(key, title, rows, dflt) {
  if (!rows.length) return "";
  const k = "home:" + key, open = isOpen(k, dflt !== false);
  return `<section class="hgrp"><button class="hg-h" data-tog="${k}" data-dflt="${dflt === false ? 0 : 1}" aria-expanded="${open}"><span class="hg-t">${title}</span><span class="hg-n">${rows.length}</span><span class="chev"></span></button>${open ? `<div class="hg-b">${rows.join("")}</div>` : ""}</section>`;
}
function homeGroups(items, target) {
  const mine = items.filter(i => target === "All" || (i.owner || "Chris") === target);
  const g = { overdue: [], today: [], tomorrow: [], week: [], later: [] };
  for (const it of mine) { const n = dayDiff(dueDate(it)); (n < 0 ? g.overdue : n === 0 ? g.today : n === 1 ? g.tomorrow : n <= 7 ? g.week : g.later).push(it); }
  const byDue = (a, b) => dueDate(a) - dueDate(b) || byPrioThenAge(a, b);
  g.overdue.sort(byPrioThenAge); g.today.sort(byPrioThenAge); g.tomorrow.sort(byPrioThenAge); g.week.sort(byDue); g.later.sort(byDue);
  return { mine, g, sugg: mine.filter(i => i.state === "Proposed") };
}
function todayHtml(items) {
  const target = who === "All" ? "All" : (who || me || "Chris");
  const { mine, g, sugg } = homeGroups(items, target);
  const br = parseBrief(window._brief);
  const hr = SA().getUTCHours();
  let h = `<section class="hello"><div class="hn">${hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"}, ${esc(me || "there")} · ${dayName(Date.now())}</div></section>`;
  h += `<div class="chips whochips segbar">${["Chris", "Annemarie", "All"].map(c => `<button data-who="${c}" class="${target === c ? "on" : ""}">${c === "All" ? "Both of us" : c}</button>`).join("")}</div>`;
  // suggestions from the bot: accept all in one tap (a person decides; the bot never confirms)
  if (sugg.length) h += `<div class="sbar"><span>${sugg.length} suggested by the bot</span><button class="primary" data-qa="acceptall">${ic("check")}Accept all</button></div>`;
  const all = target === "All";
  h += `<div class="hlist">`;
  h += hLabel("Overdue", g.overdue.map(i => homeRow(i, all)));
  h += hLabel("Today", g.today.map(i => homeRow(i, all)));
  h += hLabel("Tomorrow", g.tomorrow.map(i => homeRow(i, all)));
  h += hLabel("Next 7 days", g.week.map(i => homeRow(i, all)));
  h += hGroup("later", "Later than a week", g.later.map(i => homeRow(i, all)), false);
  // brief: one or two lines, "Read more" opens the rest
  const sum = br && br.summary ? br.summary : br && br.legacy ? "Older brief – tap Refresh for the new version." : botBusy ? "Writing today's brief…" : "No brief yet today – tap Refresh.";
  const bOpen = isOpen("home:brief", false);
  if (!bOpen) h += `<div class="bline"><button class="bl-main" data-tog="home:brief" data-dflt="0" aria-expanded="false"><span class="bl-l">Today's brief</span><span class="bl-t">${esc(sum)}</span></button></div>`;
  else h += `<div class="brief"><div class="bt"><span class="l">Today's brief</span><button type="button" class="ib t-me${botBusy ? " spin" : ""}" data-bot="brief-here" aria-label="${br ? "Refresh the brief" : "Get today's brief"}">${ic("refresh")}<span class="ibw">Refresh</span></button>${ib("me", "me", `data-emailbrief="1"`, "Email me today's list")}</div>
    <div class="tsum${br && br.summary ? "" : " none"}">${esc(sum)}</div><button class="linkb more" data-tog="home:brief" data-dflt="0">Close the brief</button></div>`;
  if (!mine.length) h += `<div class="empty">Nothing on ${target === "All" ? "the list" : esc(target) + "'s list"}. Tap + to add a task.</div>`;
  // next steps on deals and the buyer search (open where the work is done)
  const ld = liveDeals();
  const dealRows = ld.map(d => ({ d, pg: dealProgress(d.id) })).filter(x => x.pg.next).map(({ d, pg }) => linkRow(`deal:${d.id}:${pg.next.id}`, esc(pg.next.title), `Next step · ${esc(d.name)}`, "r-deal"));
  h += hGroup("deals", "Next step on each deal", dealRows);
  const td = saKey(Date.now());
  const gOpen = k => ((window._gates || []).find(x => x.key === k) || {}).status === "open";
  const queue = (window._ltasks || []).filter(t => t.status === "open" && !(t.gates || []).some(gOpen) && (!t.not_before || t.not_before <= td)).sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, 3);
  h += hGroup("buyers", "Buyer search – next 3", queue.map(t => { const ls = (t.lead_ids || []).map(id => (window._leads || []).find(l => l.id === id)).filter(Boolean);
    return linkRow(ls.length === 1 ? "lead:" + ls[0].id : "task:" + t.id, esc(t.task), ["Buyer search", t.kind ? kindName(t.kind) : "", ls.length > 1 ? ls.length + " leads" : ""].filter(Boolean).join(" · "), "r-deal"); }));
  const risks = (br && br.risks) || [];
  const refName = r => r.ref_type === "item" ? (((window._items || []).find(i => i.id === r.ref_id) || {}).waiting_for || "") : r.ref_type === "deal" ? ((dealById(r.ref_id) || {}).name || "") : r.ref_type === "lead" ? (((window._leads || []).find(l => l.id === r.ref_id) || {}).name || "") : "";
  h += hGroup("risks", "Risks the bot spotted", risks.map(r => r.ref_type && r.ref_id && refName(r) ? linkRow(r.ref_type + ":" + r.ref_id, esc(r.text), "On: " + esc(refName(r)), "r-bad") : `<div class="hrow r-bad"><div class="hr-main"><span class="hr-t">${esc(r.text)}</span></div></div>`), false);
  h += `</div>`;
  // overview below the list: progress rings, deal tiles, this week
  const st = ld.reduce((a, d) => { const pg = dealProgress(d.id); a[0] += pg.done; a[1] += pg.total; return a; }, [0, 0]);
  const L = window._leads || [], reached = L.filter(l => ["contacted", "replied", "qualified", "deal"].includes(l.status)).length;
  const doneWk = (window._done || []).filter(i => (all || (i.owner || "Chris") === target) && Date.now() - new Date(i.updated_at).getTime() < 7 * 864e5).length;
  const oOpen = isOpen("home:overview", true);
  h += `<section class="hgrp ov"><button class="hg-h" data-tog="home:overview" data-dflt="1" aria-expanded="${oOpen}"><span class="hg-t">Overview</span><span class="chev"></span></button>`;
  if (oOpen) {
    h += `<div class="card prog">${ringsSvg([st[1] ? st[0] / st[1] : 0, L.length ? reached / L.length : 0, mine.length ? (mine.length - g.overdue.length) / mine.length : 0])}
      <div class="legend"><div class="lg"><i style="background:linear-gradient(135deg,#964EC2,#FF7BBF)"></i><div><b>Deal steps: ${st[0]} of ${st[1]} done</b><span>all live deals together</span></div></div>
      <div class="lg"><i style="background:#FF7BBF"></i><div><b>Buyer list: ${reached} of ${L.length} contacted</b></div></div>
      <div class="lg"><i style="background:#5FD9C9"></i><div><b>Tasks: ${g.overdue.length} overdue of ${mine.length}</b><span>${doneWk} done in the last 7 days</span></div></div></div></div>`;
    if (ld.length) h += `<div class="sech"><h3>Deals</h3><button class="linkb" data-v2="deals">All deals</button></div><div class="dgrid">${ld.map(dtile).join("")}</div>`;
    const now = SA(), dow = (now.getUTCDay() + 6) % 7, mon = new Date(now.getTime() - dow * 864e5);
    const days = [...Array(7)].map((_, i) => new Date(mon.getTime() + i * 864e5));
    const byDay = {}; for (const it of mine) { const k = dayDiff(dueDate(it)) < 0 ? td : saKey(dueDate(it)); (byDay[k] ||= []).push(it); }
    h += `<div class="card week"><div class="wk-m">This week · tasks due each day</div><div class="wk">${days.map(d => { const k = d.toISOString().slice(0, 10), n = (byDay[k] || []).length;
      return `<div><div class="wd">${WDAY[d.getUTCDay()]}</div><div class="dd${k === td ? " today" : ""}">${d.getUTCDate()}</div><div class="wn">${n ? n : ""}</div></div>`; }).join("")}</div></div>`;
  }
  h += `</section>`;
  if (br && br.legacy) h += hGroup("old", "Older brief (plain text)", br.legacy.split(/\n+/).filter(Boolean).map(l => `<div class="tline">${esc(l)}</div>`), false);
  return h;
}
// Accept / Drop straight from the list, and Accept all
async function quickItemAction(id, action) {
  if (DEMO) { const it = (window._items || []).find(i => i.id === id); if (!it) return true; if (action === "confirm") it.state = "Confirmed"; else window._items = window._items.filter(i => i.id !== id); return true; }
  const { error } = await sb.rpc("item_action", { p_id: id, p_action: action, p_value: null });
  if (error) { toast("Could not save: " + error.message, 6000); return false; }
  return true;
}
$("list").addEventListener("click", async e => {
  const q = e.target.closest("button[data-qa]"); if (!q) return;
  q.disabled = true;
  if (q.dataset.qa === "acceptall") {
    const target = who === "All" ? "All" : (who || me || "Chris");
    const list = homeGroups(window._items || [], target).sugg;
    let n = 0; for (const it of list) if (await quickItemAction(it.id, "confirm")) n++;
    toast(`${n} suggestion${n === 1 ? "" : "s"} accepted.`);
  } else {
    const ok = await quickItemAction(q.dataset.qid, q.dataset.qa);
    if (ok) toast(q.dataset.qa === "confirm" ? "Accepted – it's on the list now." : "Dropped.");
  }
  if (DEMO) render(); else load();
});
$("list").addEventListener("click", e => { const b = e.target.closest("button[data-v2]"); if (b) goView(b.dataset.v2); });
window.todayHtml = todayHtml;

function briefAsText() {
  const br = parseBrief(window._brief);
  const target = who || me || "Chris";
  const items = (window._items || []).filter(i => who === "All" || (i.owner || "Chris") === target);
  const lines = [];
  if (br && br.summary) lines.push(br.summary, "");
  const ord = (br && br.chase_order) || [];
  const chase = items.filter(i => !i._me && (ord.includes(i.id) || (i._stale && i.state !== "Proposed"))).sort((a, b) => ((ord.indexOf(a.id) + 1) || 999) - ((ord.indexOf(b.id) + 1) || 999) || byPrioThenAge(a, b));
  if (chase.length) lines.push("CHASE TODAY", ...chase.map((i, n) => `${n + 1}. ${i.waiting_on}: ${i.waiting_for} (${sinceWords(i)})${i.next_action ? " – next: " + i.next_action : ""}`), "");
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
    const it = (window._items || []).find(i => i.id === id); if (!it) { toast("That item is closed or gone."); return; }
    if (window.openItemSheet) { openItemSheet(id); return; }
    navPush(); view = "worklist"; openKeys.delete("-ti:" + id); openKeys.add("+ti:" + id); saveOpen(); render(); scrollTo(`[data-tgo="item:${id}"]`); return;
  }
  if (type === "deal") {
    const d = dealById(id); if (!d) { toast("That deal is not on the board."); return; }
    navPush(); view = "deal"; openDealPage(id); try { localStorage.setItem("view", view); } catch (e) {}
    if (extra) { const st = (window._steps || []).find(s => s.id === extra); if (st) { if (window.setDealTab) setDealTab(id, "steps"); openKeys.delete(`-stage:${id}:${st.stage}`); openKeys.add(`+stage:${id}:${st.stage}`); openStep = st.id; } }
    saveOpen(); render(); if (extra) scrollTo(`[data-step="${extra}"]`); else window.scrollTo(0, 0); return;
  }
  if (type === "lead") {
    const l = (window._leads || []).find(x => x.id === id); if (!l) { toast("That lead is not in the directory."); return; }
    navPush(); view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    dSeg = "all"; dStat = "any"; dCountry = ""; dQ = l.name; dOpen = l.id; render(); scrollTo(`#lead-${id}`); return;
  }
  if (type === "task") {
    navPush(); view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    openKeys.delete("-dq"); dTaskDone = id; render();
    const inTop = document.querySelector(`[data-dtaskact="${id}"]`);
    if (!inTop) { openKeys.add("+dq:more"); openKeys.add("+dq:gated"); openKeys.add("+dq:later"); saveOpen(); render(); }
    scrollTo("#tOut"); return;
  }
  if (type === "contact") { navPush(); view = "leads"; if (window.setDirSeg) setDirSeg("saved"); openPanels.add("contact:" + id); render(); scrollTo(`.ccard[data-cid="${id}"]`); return; }
}
window.goTo = goTo;

$("list").addEventListener("click", async e => {
  const g = e.target.closest("button[data-tgo]"); if (g) { goTo(g.dataset.tgo); return; }
  const w = e.target.closest("button[data-wadraft]");
  if (w) { const d = (window._drafts || []).find(x => String(x.id) === w.dataset.draft); location.href = `https://wa.me/${w.dataset.wadraft}?text=` + encodeURIComponent(d ? d.new_value : ""); return; }
  const c = e.target.closest("button[data-copydraft]");
  if (c) { const d = (window._drafts || []).find(x => String(x.id) === c.dataset.copydraft); try { await navigator.clipboard.writeText(d ? d.new_value : ""); toast("Copied."); } catch (er) { toast("Copy not allowed here – long-press the text."); } return; }
});
