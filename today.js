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
  const R = [52, 41, 30];   // ring colours come from the palette (--ring1..3 in the stylesheets)
  return `<svg class="rings" viewBox="0 0 128 128" aria-hidden="true">${R.map((r, i) => { const c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, vals[i] || 0)); return `<circle cx="64" cy="64" r="${r}" class="bg"/><circle cx="64" cy="64" r="${r}" style="stroke:var(--ring${i + 1})" stroke-dasharray="${(p * c).toFixed(1)} ${c.toFixed(1)}"${p === 0 ? ' stroke-opacity="0"' : ""}/>`; }).join("")}</svg>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function dtile(d) {
  const pg = dealProgress(d.id), waits = itemsOf(d.id);
  const owners = [...new Set(waits.map(i => i.owner || "Chris"))];
  const kindIc = d.kind === "transport" ? ["truck", "#72A9FF"] : d.kind === "mineral" ? ["gem", "#C7B6FF"] : ["deals", "#F0C05A"];
  const av = owners.map(o => `<span style="background:${o === "Annemarie" ? "#FF9CCB" : "#C7B6FF"}" title="${esc(o)}">${esc(o[0])}</span>`).join("");
  return `<button class="dtile" data-tgo="deal:${d.id}"><span class="dt-top"><span class="dt-ic" style="--c:${kindIc[1]}">${ic(kindIc[0])}</span><span class="avs">${av}</span></span><span class="dt-n">${esc(d.name)}</span><span class="dt-p"><span class="pbar"><i style="width:${pct(pg.done, pg.total)}%"></i></span><span class="dt-c">${pg.done} of ${pg.total}</span></span></button>`;
}
// One task = one line (what) + one line of plain words (kind · due · who).
// Rail colour = priority: urgent red, overdue amber, suggested grey, low slate, normal blue (palette colour).
function homeRow(it, showOwner, noWho) {
  const n = dayDiff(dueDate(it)), dw = dueWords(it);
  if (it._ft) {   // a buyer-search step waiting on a reply (follow-up) – opens the step with its Done / Follow up form
    const t = it._ft, l = (t.lead_ids || []).length === 1 ? (window._leads || []).find(x => x.id === t.lead_ids[0]) : null;
    const who = l ? (l.person ? l.person.split(/[,(]/)[0].trim() + " – " + l.name : l.name) : t.task;
    const meta = ["Follow up", n < 0 ? "Overdue" : dw, t.outcome, showOwner ? (t.owner || "Chris") : ""].filter(Boolean).join(" · ");
    const fs = window.secsOfLTask ? secsOfLTask(t) : [], fc = fs.length === 1 ? secColor(fs[0]) : "var(--s-all)";
    return `<div class="hrow${n < 0 ? " r-warn" : ""}" style="--rc:${fc}"><button class="hr-main" data-tgo="task:${t.id}"><span class="hr-t">${esc(who)}</span><span class="hr-m">${secTag(fs)}${esc(meta)}</span></button></div>`;
  }
  const sugg = it.state === "Proposed";
  const rail = it.priority === 1 ? " r-bad" : n < 0 ? " r-warn" : sugg ? " r-prop" : it.priority === 3 ? " r-low" : "";
  const meta = [kindWords(it), it.priority === 1 ? "Urgent" : "", sugg ? sinceWords(it) : it._me ? dw : `${dw} · ${sinceWords(it)}`, showOwner ? (it.owner || "Chris") : ""].filter(Boolean).join(" · ");
  const ss = window.secsOfItem ? secsOfItem(it) : [], rc = ss.length === 1 ? secColor(ss[0]) : "var(--s-all)";
  return `<div class="hrow${rail}" style="--rc:${rc}"><button class="hr-main" data-tgo="item:${it.id}"><span class="hr-t">${it._me || noWho ? "" : esc(it.waiting_on) + ": "}${esc(it.waiting_for)}</span><span class="hr-m">${secTag(ss)}${meta}</span></button></div>`;
}
// section tag in front of the plain words (only when the list shows every section): a coloured dot + the name
function secTag(ss) { return typeof section === "undefined" || section !== "All" || ss.length !== 1 ? "" : `<span class="stag"><i style="background:${secColor(ss[0])}"></i>${esc(ss[0])}</span> · `; }
function linkRow(go, title, meta, rail, rc) {
  return `<div class="hrow${rail ? " " + rail : ""}"${rc ? ` style="--rc:${rc}"` : ""}><button class="hr-main" data-tgo="${esc(go)}"><span class="hr-t">${title}</span><span class="hr-m">${meta}</span></button></div>`;
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
// One card per group: coloured dot + title + count on top, rows inside with thin lines between.
// tone picks the dot colour (--g-<tone> in the stylesheets); the words stay neutral.
function hCard(key, tone, title, rows, o) {
  o = o || {};
  if (!rows.length) return "";
  const k = "home:" + key, open = o.fold ? isOpen(k, o.dflt !== false) : true;
  // Ion Rail: a block on the rail – a mono label line ("overdue · 2") then the cards, 6 px apart (docs/ION-GEOMETRY.md)
  const head = `<span class="hc-t">${title.toLowerCase()}</span><span class="hc-n">· ${rows.length}</span>${o.extra || ""}`;
  const h = o.fold ? `<button class="ilab hc-h" data-tog="${k}" data-dflt="${o.dflt === false ? 0 : 1}" aria-expanded="${open}">${head}<span class="ilab-x mono">${open ? "hide" : "show"}</span></button>` : `<div class="ilab hc-h">${head}</div>`;
  let body = rows;
  if (o.limit && rows.length > o.limit && !isOpen(k + ":all", false)) body = rows.slice(0, o.limit).concat(`<button class="hc-more" data-tog="${k}:all" data-dflt="0">Show ${rows.length - o.limit} more</button>`);
  return `<section class="iblk hcard t-${tone}${tone === "over" || tone === "bad" ? " deep" : ""}">${h}${open ? `<div class="ibody hc-b">${body.join("")}</div>` : ""}</section>`;
}
// Ion Rail helpers (27 Sep 2026): the status row, the header plate and the sheet – see docs/ION-GEOMETRY.md
function stRow(left, right) { return `<div class="st"><span class="mono">${left}</span><span class="mono">${right}</span></div>`; }
function plateHtml(title, sub, right) { return `<section class="plate"><div class="pl-l"><h2 class="pl-t">${title}</h2>${sub ? `<div class="pl-s">${sub}</div>` : ""}</div>${right || ""}</section>`; }
function meterHtml() {
  const d = SA(), day = d.getUTCDate(), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), on = Math.round(day / dim * 30);
  return `<div class="meter" aria-label="Day ${day} of ${dim}"><span class="mono">day ${day} / ${dim}</span><span class="dots">${[...Array(30)].map((_, i) => `<i${i < on ? ' class="on"' : ""}></i>`).join("")}</span></div>`;
}
const sheetOpen = (l, r, cls) => `<section class="rsheet${cls ? " " + cls : ""}"><div class="rstrip"><span>${l}</span><span>${r}</span></div>`;
const sheetClose = () => `<i class="hud" aria-hidden="true"></i></section>`;
const railOpen = col => `<div class="irail" style="--col:${col || 0}px">`;
const railClose = () => `</div>`;
const rplain = (l, r, first) => `<div class="rplain${first ? " first" : ""}"><span>${l}</span><span>${r}</span></div>`;
const rfoot = t => `<div class="rfoot">${t}</div>`;
// one card on the rail (not a swipe row): a node, a hairline and an off-white card
function icardRow(o) {
  // o: {cls (row classes), node ("" | big | sm), go (data-tgo) | step (data-step) | attrs, left (html: ck/av), title, sub, right (html), cardCls, stn (html)}
  const btn = o.go ? `data-tgo="${esc(o.go)}"` : o.attrs || "";
  return `<div class="irow${o.cls ? " " + o.cls : ""}"><i class="in${o.node ? " " + o.node : ""}" aria-hidden="true"></i>${o.stn || ""}<button type="button" class="icard${o.cardCls ? " " + o.cardCls : ""}" ${btn}>${o.left || ""}<span class="t">${o.title}${o.sub ? `<small${o.mono ? ' class="mono"' : ""}>${o.sub}</small>` : ""}</span>${o.right || ""}</button></div>`;
}
window.stRow = stRow; window.plateHtml = plateHtml; window.meterHtml = meterHtml; window.sheetOpen = sheetOpen; window.sheetClose = sheetClose; window.railOpen = railOpen; window.railClose = railClose; window.rplain = rplain; window.rfoot = rfoot; window.icardRow = icardRow;
// Groups for Home. Suggestions stay apart (a person accepts them first). Buyer-search follow-ups join the day they are due.
function homeGroups(items, target) {
  const own = x => target === "All" || (x.owner || "Chris") === target || x.owner === "Both";   // a task for Both is on both lists
  const mine = items.filter(own).filter(i => !window.inSecItem || inSecItem(i));
  const sugg = mine.filter(i => i.state === "Proposed").sort(byPrioThenAge);
  const fu = (window._ltasks || []).filter(t => window.isFollowUp && isFollowUp(t) && own(t) && (!window.inSecLTask || inSecLTask(t)))
    .map(t => ({ _ft: t, id: "ft:" + t.id, due_on: t.not_before, owner: t.owner || "Chris", priority: 2, _days: 0, state: "Confirmed", created_at: t.created_at }));
  const list = mine.filter(i => i.state !== "Proposed").concat(fu);
  const g = { overdue: [], today: [], tomorrow: [], week: [], later: [] };
  for (const it of list) { const n = dayDiff(dueDate(it)); (n < 0 ? g.overdue : n === 0 ? g.today : n === 1 ? g.tomorrow : n <= 7 ? g.week : g.later).push(it); }
  const byDue = (a, b) => dueDate(a) - dueDate(b) || byPrioThenAge(a, b);
  g.overdue.sort(byPrioThenAge); g.today.sort(byPrioThenAge); g.tomorrow.sort(byPrioThenAge); g.week.sort(byDue); g.later.sort(byDue);
  return { mine, list, g, sugg, fu };
}
// Tiles on top: tap one to see only those; tap it again (or "Show everything") for the whole list.
let homeFilter = null;
const HF = [["urgent", "bad", "Urgent", "flag"], ["overdue", "over", "Overdue", "clock"], ["today", "today", "Today", "sun"], ["week", "week", "This week", "list"]];
// Today – modern (26 Sep evening, Chris: "the whole layout still looks old tech – new, exceptionally modern, with
// interactivity"). Big greeting · whose list · a 7-day strip (tap a day) · "Next up" hero with its actions · three tiles ·
// the brief · suggestions as swipeable cards · tasks by day as rows you can swipe for quick actions (Done / Chased /
// Tomorrow – each action is a real button, and the same actions are in the task sheet). Colour: the avatar carries the
// section, the status chip carries priority (urgent red, late amber, suggested grey); every word stays neutral.
let homeDay = null;   // a day picked on the strip (YYYY-MM-DD): only that day's tasks (today also shows the late ones)
// t = the full words; sh = the short form the Ion Rail shows in the pill on the right of a row ("4d", "Today", "Wed 30")
const chip2 = (tone, t, sh) => `<span class="chip2 c-${tone}"${sh ? ` title="${esc(t)}"` : ""}><i></i>${sh ? `<span class="cl">${esc(t)}</span><span class="cs">${esc(sh)}</span>` : esc(t)}</span>`;
function stChip(it) {
  const n = dayDiff(dueDate(it)), late = n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : "", d = dueDate(it);
  const dayShort = n === 0 ? "Today" : n === 1 ? "Tmrw" : d ? WDAY[new Date(d).getUTCDay()] + " " + new Date(d).getUTCDate() : "";
  if (it._ft) return n < 0 ? chip2("warn", "Follow-up " + late, -n + "d late") : chip2("plain", "Follow up " + (n === 0 ? "today" : n === 1 ? "tomorrow" : dayName(dueDate(it))), dayShort);
  if (it.state === "Proposed") return chip2("prop", it.priority === 1 ? "Suggested · Urgent" : "Suggested", "Suggested");
  if (it.priority === 1) return chip2("bad", late ? "Urgent · " + late : "Urgent", late ? -n + "d late" : "Urgent");
  if (late) return chip2("warn", late, -n + "d late");
  return chip2(n === 0 ? "today" : "plain", n === 0 ? "Today" : n === 1 ? "Tomorrow" : dayName(dueDate(it)), dayShort);
}
function av2(label, secs, icon) {
  const c = secs && secs.length === 1 ? secColor(secs[0]) : "var(--s-all)";
  return `<span class="av2" style="--ac:${c}" aria-hidden="true">${icon ? ic(icon) : esc(initials(label))}</span>`;
}
// the parts of one task: who, what, sections, where it opens, and its quick actions (left = swipe right, right = swipe left)
function taskParts(it, showOwner) {
  if (it._ft) {
    const t = it._ft, l = (t.lead_ids || []).length === 1 ? (window._leads || []).find(x => x.id === t.lead_ids[0]) : null, secs = window.secsOfLTask ? secsOfLTask(t) : [];
    const who = l ? (l.person ? l.person.split(/[,(]/)[0].trim() : l.name) : "Buyer search";
    return { id: t.id, go: "task:" + t.id, who, title: l ? `Follow up ${l.name}` : t.task, meta: [t.outcome, showOwner ? (t.owner || "Chris") : ""].filter(Boolean).join(" · "), secs,
      left: [["ftdone", "check", "Done"]], right: [["fu3", "clock", "+3 work days"]] };
  }
  const sugg = it.state === "Proposed", secs = window.secsOfItem ? secsOfItem(it) : [];
  const who = it._me ? (it.owner || "Chris") : it.waiting_on;
  const meta = [it._me ? "Our job" : "Waiting on " + it.waiting_on, typeof section !== "undefined" && section === "All" && secs.length === 1 ? secs[0] : "", sinceWords(it), showOwner ? (it.owner || "Chris") : ""].filter(Boolean).join(" · ");
  return { id: it.id, go: "item:" + it.id, who, me: it._me, title: it.waiting_for, meta, secs,
    left: sugg ? [["confirm", "check", "Accept"]] : [["done", "check", "Done"]],
    right: sugg ? [["drop", "drop", "Drop"]] : it._me ? [["tomorrow", "clock", nextWorkWord()], [it.priority === 1 ? "normal" : "urgent", "flag", it.priority === 1 ? "Normal" : "Urgent"]] : [["chased", "refresh", "Chased"], ["tomorrow", "clock", nextWorkWord()]] };
}
const swBtn = (id, [act, icn, t]) => `<button type="button" class="sw-${act}" data-sw="${act}" data-id="${esc(id)}">${ic(icn)}<span>${t}</span></button>`;
// one row: swipe right for the left action, swipe left for the right ones; tap the row to open it
function swRow(it, showOwner) {
  const p = taskParts(it, showOwner), n = dayDiff(dueDate(it)), sugg = it.state === "Proposed";
  const rc = sugg ? " prop" : it.priority === 1 ? " urgent" : n < 0 ? " late" : "";
  // the pill on the right: coral for late, a plain word for a day, an Accept button for a suggestion (the mock's "Accept")
  return `<div class="irow${rc}"><i class="in" aria-hidden="true"></i><div class="hrow swrow" data-row="${esc(p.id)}"><div class="strack"><div class="sact l">${p.left.map(x => swBtn(p.id, x)).join("")}</div>
    <div class="scont"><button class="hr-main" data-tgo="${esc(p.go)}">${av2(p.who, p.secs, p.me ? "checkbox" : it._ft ? "user" : "")}<span class="hr-tx"><span class="hr-t">${esc(p.title)}</span><span class="hr-m">${stChip(it)}<span class="hr-mt">${esc(p.meta)}</span></span></span>${stChip(it)}</button>${sugg ? `<button type="button" class="tag i acc" data-sw="confirm" data-id="${esc(p.id)}">Accept</button>` : ""}</div>
    <div class="sact r">${p.right.map(x => swBtn(p.id, x)).join("")}</div></div></div></div>`;
}
function saClock() { const d = SA(); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); }
const nowLine = () => `<div class="inow" aria-hidden="true"><i></i><span>${saClock()} now</span></div>`;
window.saClock = saClock;
// the one thing to do next: urgent first, then late, then today, then the soonest
function nextUp(list) {
  const score = it => (it.priority === 1 ? 0 : 10) + Math.max(-5, Math.min(30, dayDiff(dueDate(it))));
  return list.slice().sort((a, b) => score(a) - score(b) || dueDate(a) - dueDate(b))[0] || null;
}
function heroHtml(it, showOwner) {
  const p = taskParts(it, showOwner), c = p.secs.length === 1 ? secColor(p.secs[0]) : "var(--s-all)";
  return `<section class="hero2" style="--ac:${c}" aria-label="Next up"><div class="h2-top"><span class="h2-l">Next up</span>${stChip(it)}</div>
    <button class="h2-main" data-tgo="${esc(p.go)}">${av2(p.who, p.secs, p.me ? "checkbox" : it._ft ? "user" : "")}<span class="h2-tx"><span class="h2-t">${esc(p.title)}</span><span class="h2-m">${esc(p.meta)}</span></span></button>
    <div class="h2-acts">${[...p.left, ...p.right].slice(0, 3).map(x => swBtn(p.id, x)).join("")}</div></section>`;
}
// seven days from today: tap one to see only that day
function weekStripHtml(list) {
  const td = saKey(Date.now()), days = [...Array(7)].map((_, i) => saDayPlus(i));
  const cnt = {}, late = list.filter(it => dayDiff(dueDate(it)) < 0).length;
  for (const it of list) { const n = dayDiff(dueDate(it)); const k = n < 0 ? td : saKey(dueDate(it)); cnt[k] = (cnt[k] || 0) + 1; }
  return `<div class="wkstrip" role="group" aria-label="Pick a day">${days.map((k, i) => { const d = new Date(k + "T08:00:00+02:00"), n = cnt[k] || 0, on = homeDay === k;
    return `<button type="button" data-hday="${k}" class="${on ? "on" : ""}${i === 0 ? " today" : ""}" aria-pressed="${on}" aria-label="${i === 0 ? "Today" : dayName(d)}: ${n} task${n === 1 ? "" : "s"}${holidayOn(k) ? ", " + esc(holidayOn(k)) : ""}"${holidayOn(k) ? ` data-hol="1"` : ""}><span class="wd2">${i === 0 ? "Today" : WDAY[d.getUTCDay()]}</span><span class="dn2">${d.getUTCDate()}</span><span class="dots">${[...Array(Math.min(3, n))].map((_, j) => `<i${i === 0 && j < late ? ' class="late"' : ""}></i>`).join("")}</span></button>`; }).join("")}</div>${holidayNote(days)}${window.portWeatherNote ? portWeatherNote() : ""}`;
}
// a public holiday in the next seven days: one plain line under the strip
function holidayNote(days) {
  const hs = days.filter(k => holidayOn(k)); if (!hs.length) return "";
  return `<div class="holnote"><i class="dot"></i>${hs.map(k => `${k === days[0] ? "Today" : dayName(new Date(k + "T08:00:00+02:00"))} is ${esc(holidayOn(k))}`).join(" · ")} – offices and many depots closed.</div>`;
}
function todayHtml(items) {
  const target = who === "All" ? "All" : (who || me || "Chris");
  const { mine, list, g, sugg } = homeGroups(items, target);
  const br = parseBrief(window._brief);
  const all = target === "All", d = SA();
  const date = d.toLocaleDateString("en-ZA", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const waiting = list.filter(i => !i._me && !i._ft).length;
  const secOn = typeof section !== "undefined" && section !== "All" ? section : "";
  // status row + header plate (the mock's "Today · 2 late · 3 due · 7 waiting · day 27 / 30")
  const secDeals = secOn ? (window._deals || []).filter(x => x.area === secOn && (x.status === "Active" || x.status === "On hold")).length : 0;
  let h = stRow(`${saClock()} <span class="live"><i></i>live</span>`, secOn ? `${esc(secOn.toLowerCase())} · ${secDeals} deal${secDeals === 1 ? "" : "s"} · ${list.length} open` : `${esc(date)}${g.overdue.length ? ` · ${g.overdue.length} late` : ""}`);
  // a section's plate reads like the mock: its live deal and what the buyer wants; otherwise the day's counts
  const secDeal = secOn ? (window._deals || []).find(x => x.area === secOn && (x.status === "Active" || x.status === "On hold")) : null, sp = (secDeal && secDeal.params) || {};
  const secSub = secDeal ? [secDeal.name, sp.volume || sp.client_rate || sp.cargo].filter(Boolean).join(" · ") : secOn ? `no ${secOn.toLowerCase()} deal yet` : "";
  h += plateHtml(esc(secOn || "Today"), esc(secSub) || `${g.overdue.length} late · ${g.today.length} due · ${waiting} waiting`, meterHtml());
  h += `<div class="chips whochips segbar" role="group" aria-label="Whose list">${["Chris", "Annemarie", "All"].map(c => `<button data-who="${c}" class="${target === c ? "on" : ""}" aria-pressed="${target === c}">${c === "All" ? "Both of us" : c}</button>`).join("")}</div>`;
  h += weekStripHtml(list);
  if (window.meetingsHtml) h += meetingsHtml(target);
  const cnt = { urgent: list.filter(i => i.priority === 1).length + sugg.filter(i => i.priority === 1).length, overdue: g.overdue.length, sugg: sugg.length };
  const R = arr => arr.map(i => swRow(i, all));
  const cards = [["overdue", "over", "Overdue", g.overdue], ["today", "today", "Today", g.today], ["tomorrow", "tmrw", "Tomorrow", g.tomorrow], ["week", "week", "Next 7 days", g.week], ["later", "later", "Later than a week", g.later]];
  const tiles = `<div class="htiles htiles3" role="group" aria-label="Show only">${[["urgent", "bad", "Urgent", "flag", cnt.urgent], ["overdue", "over", "Late", "clock", cnt.overdue], ["sugg", "prop", "Suggested", "sparkle", cnt.sugg]].map(([k, tone, t, icn, n]) => { const on = homeFilter === k; return `<button class="htile t-${tone}${on ? " on" : ""}" ${k === "sugg" ? 'data-jump="sugg"' : `data-hf="${k}"`} aria-pressed="${on}"><span class="ht-top"><span class="ht-n" data-count="${n}">${n}</span><span class="ht-i">${ic(icn)}</span></span><span class="ht-l">${t}</span></button>`; }).join("")}</div>`;
  const strip = r => sheetOpen(`rail · time${secOn ? " · " + esc(secOn.toLowerCase()) + " only" : ""}`, r, "hlist") + railOpen(0);
  // a day picked on the strip, or a tile: only those
  if (homeDay || homeFilter) {
    h += tiles + strip(homeDay ? "one day" : "filtered");
    let out = "";
    if (homeDay) {
      const td = saKey(Date.now()), pick = list.filter(it => { const n = dayDiff(dueDate(it)); return homeDay === td ? n <= 0 : saKey(dueDate(it)) === homeDay; });
      out = hCard("f-day", homeDay === td ? "today" : "week", homeDay === td ? "Today (and late)" : dayName(new Date(homeDay + "T08:00:00+02:00")), R(pick.sort(byPrioThenAge)));
    } else {
      const only = homeFilter === "urgent" ? (arr => arr.filter(i => i.priority === 1)) : (arr => arr);
      out = cards.filter(([k]) => homeFilter === "urgent" || homeFilter === k).map(([k, tone, t, arr]) => hCard("f-" + k, tone, t, R(only(arr)))).join("");
      if (homeFilter === "urgent") out = hCard("f-sugg", "prop", "Suggested", R(only(sugg))) + out;
    }
    h += out || `<div class="empty">Nothing ${homeDay ? "due that day" : homeFilter === "overdue" ? "late" : homeFilter} right now.</div>`;
    return h + railClose() + sheetClose() + `<button class="wide hf-all" data-hf="">Show everything</button>`;
  }
  const nx = nextUp(list); if (nx) h += heroHtml(nx, all);
  h += tiles;
  // the brief: one line, tap to read it all
  const sum = br && br.summary ? br.summary : br && br.legacy ? "Older brief – tap Refresh for the new version." : botBusy ? "Writing today's brief…" : "No brief yet today – tap Refresh.";
  const bOpen = isOpen("home:brief", false);
  if (!bOpen) h += `<div class="bline"><button class="bl-main" data-tog="home:brief" data-dflt="0" aria-expanded="false"><span class="bl-l">${ic("brief")}Today's brief</span><span class="bl-t">${esc(sum)}</span></button></div>`;
  else h += `<div class="brief"><div class="bt"><span class="l">Today's brief</span><button type="button" class="ib t-me${botBusy ? " spin" : ""}" data-bot="brief-here" aria-label="${br ? "Refresh the brief" : "Get today's brief"}">${ic("refresh")}<span class="ibw">Refresh</span></button>${ib("me", "me", `data-emailbrief="1"`, "Email me today's list")}</div>
    <div class="tsum${br && br.summary ? "" : " none"}">${esc(sum)}</div><button class="linkb more" data-tog="home:brief" data-dflt="0">Close the brief</button></div>`;
  // the rail: late above the now line, then today, tomorrow, the week, later; suggestions are rows with an Accept pill
  h += strip("now " + saClock());
  if (g.overdue.length) h += hCard("overdue", "over", "Overdue", R(g.overdue));
  if (list.length || sugg.length) h += nowLine();
  if (sugg.length) h += hCard("sugg", "prop", "Suggested", R(sugg), { extra: `<button type="button" class="ilab-x" data-qa="acceptall">${ic("check")}Accept all</button>` }).replace('class="iblk hcard t-prop"', 'class="iblk hcard t-prop sugg2" id="hsugg"');
  for (const [k, tone, t, arr] of cards) { if (k === "overdue") continue; h += hCard(k, tone, t, R(arr), k === "later" ? { fold: true, dflt: false } : undefined); }
  if (!mine.length && !list.length) h += `<div class="empty">Nothing on ${all ? "the list" : esc(target) + "'s list"}${secOn ? " in " + esc(secOn) : ""}. Tap + to add a task.</div>`;
  const risks = (br && br.risks) || [];
  const refName = r => r.ref_type === "item" ? (((window._items || []).find(i => i.id === r.ref_id) || {}).waiting_for || "") : r.ref_type === "deal" ? ((dealById(r.ref_id) || {}).name || "") : r.ref_type === "lead" ? (((window._leads || []).find(l => l.id === r.ref_id) || {}).name || "") : "";
  h += hCard("risks", "bad", "Risks the bot spotted", risks.map(r => icardRow({ cls: "late", go: r.ref_type && r.ref_id && refName(r) ? r.ref_type + ":" + r.ref_id : "", left: `<i class="ck late"></i>`, title: esc(r.text), sub: r.ref_type && refName(r) ? "On: " + esc(refName(r)) : "" })), { fold: true, dflt: false });
  h += railClose();
  if (list.length) h += rfoot(`swipe right = done · left = chased or tomorrow · tap = everything else`);
  h += sheetClose();
  if (br && br.legacy) h += hGroup("old", "Older brief (plain text)", br.legacy.split(/\n+/).filter(Boolean).map(l => `<div class="tline">${esc(l)}</div>`), false);
  return h;
}
// quick actions from a swipe, the hero or a suggestion card – the same saves as the task sheet's buttons
async function swAct(act, id) {
  const it = (window._items || []).find(i => i.id === id), tk = (window._ltasks || []).find(t => t.id === id);
  const name = it ? it.waiting_for : tk ? tk.task : "";
  const map = { done: ["done", null, "Done"], chased: ["chased", null, "Marked chased today"], tomorrow: ["due", workDayPlus(1), workDayPlus(1) === saDayPlus(1) ? "Moved to tomorrow" : "Moved to " + dayName(new Date(workDayPlus(1) + "T08:00:00+02:00"))], urgent: ["priority", "1", "Marked urgent"], normal: ["priority", "2", "Back to normal"], confirm: ["confirm", null, "Accepted"], drop: ["drop", null, "Dropped"] };
  if (tk && (act === "ftdone" || act === "fu3")) {
    const val = act === "fu3" ? workDayPlus(3) + "|" + (tk.outcome || "No reply yet") : null;
    if (DEMO) { if (act === "ftdone") Object.assign(tk, { status: "done", done_by: me, done_at: new Date().toISOString() }); else tk.not_before = workDayPlus(3); }
    else { const { error } = await sb.rpc("task_action", { p_id: tk.id, p_action: act === "ftdone" ? "done" : "followup", p_value: val }); if (error) { toast("Could not save: " + error.message, 6000); return; } }
    toast(act === "ftdone" ? "Done: " + name : "Follow-up moved 3 days on"); if (window.buzz) buzz(); if (DEMO) render(); else load(); return;
  }
  const m = map[act]; if (!it || !m) return;
  if (DEMO) { if (act === "done" || act === "drop") window._items = window._items.filter(x => x !== it); else if (act === "confirm") it.state = "Confirmed"; else if (act === "chased") it.last_chased = new Date().toISOString(); else if (act === "tomorrow") it.due_on = m[1]; else if (m[0] === "priority") it.priority = +m[1]; }
  else { const { error } = await sb.rpc("item_action", { p_id: it.id, p_action: m[0], p_value: m[1] }); if (error) { toast("Could not save: " + error.message, 6000); return; } }
  toast(`${m[2]}: ${name}${DEMO ? " (demo)" : ""}`); if (window.buzz) buzz(); if (DEMO) render(); else load();
}
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-sw]"); if (b) { b.disabled = true; swAct(b.dataset.sw, b.dataset.id); return; }
  const d = e.target.closest("button[data-hday]"); if (d) { homeDay = homeDay === d.dataset.hday ? null : d.dataset.hday; homeFilter = null; render(); return; }
  const j = e.target.closest("button[data-jump='sugg']"); if (j) { const s = $("hsugg"); if (s) s.scrollIntoView({ block: "start", behavior: "smooth" }); }
});
// Overview (moved from Today to Deals, 26 Sep): progress rings, deal tiles, this week – for the section being viewed
function overviewHtml() {
  const target = who === "All" ? "All" : (who || me || "Chris");
  const { list, g } = homeGroups(window._items || [], target);
  const ld = liveDeals().filter(d => !window.inSecDeal || inSecDeal(d)), td = saKey(Date.now());
  const st = ld.reduce((a, d) => { const pg = dealProgress(d.id); a[0] += pg.done; a[1] += pg.total; return a; }, [0, 0]);
  // documents in across the live deals (28 Sep: the Deals tab shows deal things only – the buyer list is on People)
  const dk = ld.flatMap(d => ((window.DOCS && DOCS[d.kind]) || []).map(x => (window._docs || []).find(r => r.deal_id === d.id && r.doc === x.k))).filter(r => !r || r.status !== "na");
  const L = dk, reached = dk.filter(r => r && (r.status === "received" || r.status === "signed")).length;
  const doneWk = (window._done || []).filter(i => (target === "All" || (i.owner || "Chris") === target || i.owner === "Both") && Date.now() - new Date(i.updated_at).getTime() < 7 * 864e5).length;
  const oOpen = isOpen("home:overview", true);
  let h = `<section class="hgrp ov"><button class="hg-h" data-tog="home:overview" data-dflt="1" aria-expanded="${oOpen}"><span class="hg-t">Overview</span><span class="chev"></span></button>`;
  if (oOpen) {
    h += `<div class="card prog">${ringsSvg([st[1] ? st[0] / st[1] : 0, L.length ? reached / L.length : 0, list.length ? (list.length - g.overdue.length) / list.length : 0])}
      <div class="legend"><div class="lg"><i style="background:var(--ring1-bg)"></i><div><b>Deal steps: ${st[0]} of ${st[1]} done</b><span>all live deals together</span></div></div>
      <div class="lg"><i style="background:var(--ring2)"></i><div><b>Documents: ${reached} of ${L.length} in</b><span>NCNDA, LOI, SPA … on the live deals</span></div></div>
      <div class="lg"><i style="background:var(--ring3)"></i><div><b>Tasks: ${g.overdue.length} overdue of ${list.length}</b><span>${doneWk} done in the last 7 days</span></div></div></div></div>`;
    const now = SA(), dow = (now.getUTCDay() + 6) % 7, mon = new Date(now.getTime() - dow * 864e5);
    const days = [...Array(7)].map((_, i) => new Date(mon.getTime() + i * 864e5));
    const byDay = {}; for (const it of list) { const k = dayDiff(dueDate(it)) < 0 ? td : saKey(dueDate(it)); (byDay[k] ||= []).push(it); }
    h += `<div class="card week"><div class="wk-m">This week · tasks due each day</div><div class="wk">${days.map(d => { const k = d.toISOString().slice(0, 10), n = (byDay[k] || []).length;
      return `<div><div class="wd">${WDAY[d.getUTCDay()]}</div><div class="dd${k === td ? " today" : ""}">${d.getUTCDate()}</div><div class="wn">${n ? n : ""}</div></div>`; }).join("")}</div></div>`;
  }
  return h + `</section>`;
}
window.overviewHtml = overviewHtml;
// tap a tile: only those tasks; tap it again (or Show everything) for the whole list
$("list").addEventListener("click", e => {
  const f = e.target.closest("button[data-hf]"); if (!f) return;
  const v = f.dataset.hf || null; homeFilter = v && homeFilter !== v ? v : null; homeDay = null; render(); window.scrollTo(0, 0);
});
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
  const items = (window._items || []).filter(i => who === "All" || (i.owner || "Chris") === target || i.owner === "Both");
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
    if (extra) { const st = (window._steps || []).find(s => s.id === extra); if (st) { const sg = window.leanStageOf ? leanStageOf(id, st.id) : st.stage; if (window.setDealTab) setDealTab(id, "steps"); openKeys.delete(`-stage:${id}:${sg}`); openKeys.add(`+stage:${id}:${sg}`); openStep = st.id; } }
    saveOpen(); render(); if (extra) scrollTo(`[data-step="${extra}"]`); else window.scrollTo(0, 0); return;
  }
  if (type === "lead") {
    const l = (window._leads || []).find(x => x.id === id); if (!l) { toast("That lead is not in the directory."); return; }
    navPush(); view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    dSeg = "all"; dStat = "any"; dCountry = ""; dQ = l.name; dOpen = l.id; render(); scrollTo(`#lead-${id}`); return;
  }
  if (type === "task") {
    // open the step with its Done / Follow up form: on its lead card when it has one lead, otherwise in the buyer-search queue
    const tk = (window._ltasks || []).find(x => x.id === id), lid = tk && (tk.lead_ids || []).length === 1 ? tk.lead_ids[0] : null;
    const l = lid && (window._leads || []).find(x => x.id === lid);
    navPush(); view = "leads"; try { localStorage.setItem("view", view); } catch (e) {}
    dTaskDone = id;
    const toForm = () => setTimeout(() => { const el = document.querySelector(".tdone"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 30);
    if (l) { if (window.setDirSeg) setDirSeg("all"); dSeg = "all"; dStat = "any"; dCountry = ""; dQ = l.name; dOpen = l.id; openKeys.delete(`-lc:${l.id}:next`); saveOpen(); render(); toForm(); return; }
    openKeys.delete("-dq"); openKeys.add("+dq"); openKeys.add("+dq:more"); openKeys.add("+dq:gated"); openKeys.add("+dq:later"); saveOpen(); render(); toForm(); return;
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

// one-off public holidays (e.g. an election day) from the server's list, checked once a week; the fixed ones are worked out in the phone
async function loadHolidayExtras() {
  try { const c = JSON.parse(localStorage.getItem("holExtra") || "null"); if (c && Date.now() - c.at < 7 * 864e5) { if (!window._holExtra) { window._holExtra = c.list; window._holMap = null; } return; } } catch (e) {}
  if (typeof DEMO !== "undefined" && DEMO) { window._holExtra = [{ date: "2026-11-04", name: "Election Day" }]; window._holMap = null; return; }
  if (window._holBusy) return; window._holBusy = true;
  try {
    const { data } = await sb.functions.invoke("tools", { body: { action: "holidays" } });
    const list = ((data && data.holidays) || []).map(h => ({ date: h.date, name: h.name }));
    if (list.length) { window._holExtra = list; window._holMap = null; try { localStorage.setItem("holExtra", JSON.stringify({ at: Date.now(), list })); } catch (e) {} if (view === "worklist") render(); }
  } catch (e) {}
}
(window._after ||= []).push(() => { if (!window._holExtra) loadHolidayExtras(); });
