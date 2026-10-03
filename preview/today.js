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

// ---------- Home: greeting, focus cards, progress rings, deal tiles, week schedule ----------
const SA = () => new Date(Date.now() + 2 * 3600e3);
const saKey = d => new Date(new Date(d).getTime() + 2 * 3600e3).toISOString().slice(0, 10);
function dueOf(it) { const base = new Date(it.last_chased || it.created_at); return new Date(base.getTime() + (it.nudge_after_days || 3) * 864e5); }
function fcard(it, hot) {
  const dw = dueWords(it);
  const tag = it.state === "Proposed" ? ["confirm", "Suggested"] : dw === "Overdue" ? ["chase", "Overdue"] : dw === "Due today" ? ["today", "Due today"] : it._me ? ["ours", "Our job"] : ["ok", "Waiting on them"];
  return `<button class="fcard${hot ? " hot" : ""}" data-tgo="item:${it.id}"><span class="fc-top"><span>${it._me ? esc(it.owner || "Chris") : esc(it.waiting_on)}</span>${ic("more")}</span><span class="fc-t">${esc(it.waiting_for)}</span><span class="fc-b"><span class="tag ${tag[0]}">${tag[1]}</span><span class="fc-d">${it.state === "Proposed" || dw === "Overdue" || dw === "Due today" ? sinceWords(it) : dw}</span></span></button>`;
}
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
  return `<button class="dtile" data-tgo="deal:${d.id}${pg.next ? ":" + pg.next.id : ""}"><span class="dt-top"><span class="dt-ic" style="--c:${kindIc[1]}">${ic(kindIc[0])}</span><span class="avs">${av}</span></span><span class="dt-n">${esc(d.name)}</span><span class="dt-p"><span class="pbar"><i style="width:${pct(pg.done, pg.total)}%"></i></span><span class="dt-c">${pg.done}/${pg.total}</span></span></button>`;
}
function srow(it) {
  const when = it.state === "Proposed" ? "Suggested" : dueWords(it);
  const c = it.priority === 1 ? "var(--bad)" : it.state === "Proposed" ? "var(--prop)" : it._stale ? "var(--warn)" : "var(--accent)";
  return `<button class="srow" data-tgo="item:${it.id}"><span class="sq" style="--c:${c}"></span><span class="sx"><span class="st1">${it._me ? "" : esc(it.waiting_on) + ": "}${esc(it.waiting_for)}</span><span class="st2">${when} · ${esc(it.owner || "Chris")}</span></span>${ic("chev")}</button>`;
}
function todayHtml(items) {
  const target = who === "All" ? "All" : (who || me || "Chris");
  const mine = items.filter(i => target === "All" || (i.owner || "Chris") === target);
  const br = parseBrief(window._brief);
  const order = (br && br.chase_order) || [];
  const rank = it => { const i = order.indexOf(it.id); return i < 0 ? 999 : i; };
  const chase = mine.filter(i => !i._me && (order.includes(i.id) || (i._stale && i.state !== "Proposed"))).sort((a, b) => rank(a) - rank(b) || byPrioThenAge(a, b));
  const ours = mine.filter(i => i._me).sort(byPrioThenAge);
  const proposed = mine.filter(i => i.state === "Proposed").sort(byPrioThenAge);
  const td = saKey(Date.now());
  const gOpen = k => ((window._gates || []).find(g => g.key === k) || {}).status === "open";
  const queue = (window._ltasks || []).filter(t => t.status === "open" && !(t.gates || []).some(gOpen) && (!t.not_before || t.not_before <= td)).sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, 5);
  const hr = SA().getUTCHours();
  let h = `<section class="hello"><div class="hi">${hr < 12 ? "Good morning," : hr < 17 ? "Good afternoon," : "Good evening,"}</div><div class="hn">${esc(me || "there")}</div>
    <div class="hd">${SA().toLocaleDateString("en-ZA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })} · ${chase.length} to chase · ${ours.length} of our own</div></section>`;
  h += `<div class="chips whochips">${["Chris", "Annemarie", "All"].map(c => `<button data-who="${c}" class="${target === c ? "on" : ""}">${c === "All" ? "Both of us" : c}</button>`).join("")}</div>`;
  // brief
  h += `<div class="brief"><div class="bt"><span class="l">Today's brief</span><button type="button" class="ib t-me${botBusy ? " spin" : ""}" data-bot="brief-here" aria-label="${br ? "Refresh the brief" : "Get today's brief"}" title="${br ? "Refresh the brief" : "Get today's brief"}">${ic("refresh")}<span class="ibw">Refresh</span></button>${ib("me", "me", `data-emailbrief="1"`, "Email me today's list")}</div>
    <div class="tsum${br && br.summary ? "" : " none"}">${br && br.summary ? esc(br.summary) : br && br.legacy ? "Older brief – tap Refresh for the new version." : botBusy ? "Writing today's brief…" : "No brief yet today – tap Refresh."}</div></div>`;
  // focus
  const focus = [...chase, ...ours.filter(i => !chase.includes(i))].slice(0, 10);
  h += `<div class="sech"><h3>Focus</h3><span class="sc">${focus.length ? "swipe →" : ""}</span></div><div class="carousel">${focus.map((it, i) => fcard(it, i === 0)).join("") || `<div class="fempty">Nothing to chase – well done.</div>`}</div>`;
  // progress rings
  const ld = liveDeals(), st = ld.reduce((a, d) => { const pg = dealProgress(d.id); a[0] += pg.done; a[1] += pg.total; return a; }, [0, 0]);
  const L = window._leads || [], reached = L.filter(l => ["contacted", "replied", "qualified", "deal"].includes(l.status)).length;
  const onTrack = mine.filter(i => !i._stale || i._me).length;
  const doneWk = (window._done || []).filter(i => (target === "All" || (i.owner || "Chris") === target) && Date.now() - new Date(i.updated_at).getTime() < 7 * 864e5).length;
  h += `<div class="sech"><h3>Progress</h3></div><div class="card prog">${ringsSvg([st[1] ? st[0] / st[1] : 0, L.length ? reached / L.length : 0, mine.length ? onTrack / mine.length : 0])}
    <div class="legend"><div class="lg"><i style="background:linear-gradient(135deg,#964EC2,#FF7BBF)"></i><div><b>Deal steps ${pct(st[0], st[1])}%</b><span>${st[0]} of ${st[1]} ticked</span></div></div>
    <div class="lg"><i style="background:#FF7BBF"></i><div><b>Buyer list ${pct(reached, L.length)}%</b><span>${reached} of ${L.length} contacted</span></div></div>
    <div class="lg"><i style="background:#5FD9C9"></i><div><b>On track ${pct(onTrack, mine.length)}%</b><span>${doneWk} done this week</span></div></div></div></div>`;
  // deals
  if (ld.length) h += `<div class="sech"><h3>Deals</h3><button class="linkb" data-v2="deals">See all</button></div><div class="dgrid">${ld.map(dtile).join("")}</div>`;
  // schedule
  const now = SA(), dow = (now.getUTCDay() + 6) % 7, mon = new Date(now.getTime() - dow * 864e5);
  const days = [...Array(7)].map((_, i) => new Date(mon.getTime() + i * 864e5));
  const byDay = {}; for (const it of mine) { const k = it._stale ? td : saKey(dueOf(it)); (byDay[k] ||= []).push(it); }
  h += `<div class="sech"><h3>Schedule</h3><span class="sc">chase dates</span></div><div class="card week"><div class="wk-m">${now.toLocaleDateString("en-ZA", { timeZone: "UTC", month: "long", year: "numeric" })}</div><div class="wk">${days.map(d => { const k = d.toISOString().slice(0, 10), arr = byDay[k] || [];
    return `<div><div class="wd">${WDAY[d.getUTCDay()]}</div><div class="dd${k === td ? " today" : ""}">${d.getUTCDate()}</div><div class="dots">${arr.slice(0, 3).map(i => `<i style="background:${i.priority === 1 ? "var(--bad)" : i._stale ? "var(--warn)" : "var(--accent)"}"></i>`).join("")}</div></div>`; }).join("")}</div></div>`;
  const tmr = saKey(Date.now() + 864e5), sun = saKey(days[6]);
  const dueNow = mine.filter(i => i._stale || saKey(dueOf(i)) <= td).sort(byPrioThenAge);
  const dueTmr = mine.filter(i => !dueNow.includes(i) && saKey(dueOf(i)) === tmr).sort(byPrioThenAge);
  const dueWk = mine.filter(i => !dueNow.includes(i) && !dueTmr.includes(i) && saKey(dueOf(i)) <= sun).sort((a, b) => dueOf(a) - dueOf(b));
  const later = mine.filter(i => !dueNow.includes(i) && !dueTmr.includes(i) && !dueWk.includes(i)).sort((a, b) => dueOf(a) - dueOf(b));
  h += `<div class="sgrp">Today${dueNow.length ? " · " + dueNow.length : ""}</div>${dueNow.map(srow).join("") || `<div class="quiet" style="padding:0 4px">Nothing due today.</div>`}`;
  if (dueTmr.length) h += `<div class="sgrp">Tomorrow · ${dueTmr.length}</div>${dueTmr.map(srow).join("")}`;
  if (dueWk.length) h += `<div class="sgrp">Later this week · ${dueWk.length}</div>${dueWk.map(srow).join("")}`;
  if (later.length) { const k = "home:later", o = isOpen(k, false); h += `<button class="sgrp linkb" style="padding:0;margin:16px 4px 8px" data-tog="${k}" data-dflt="0" aria-expanded="${o}">Next week and later · ${later.length} ${o ? "▴" : "▾"}</button>${o ? later.map(srow).join("") : ""}`; }
  // confirm, risks, buyer search
  let n = 0;
  if (proposed.length) h += `<div style="height:14px"></div>` + tSection(++n, "confirm", "Suggested", "Suggested by the bot – accept or drop", proposed.map(it => itemRow(it, "Suggested")));
  const risks = (br && br.risks) || [];
  const refName = r => r.ref_type === "item" ? (((window._items || []).find(i => i.id === r.ref_id) || {}).waiting_for || "") : r.ref_type === "deal" ? ((dealById(r.ref_id) || {}).name || "") : r.ref_type === "lead" ? (((window._leads || []).find(l => l.id === r.ref_id) || {}).name || "") : "";
  if (risks.length) h += tSection(++n, "risks", "Risks to check", "Spotted by the bot – tap to see where", risks.map(r => (r.ref_type && r.ref_id && refName(r))
    ? tRow({ go: r.ref_type + ":" + r.ref_id, dot: DOT.high, title: esc(r.text), sub: "On: " + esc(refName(r)), right: "" })
    : `<div class="tline"><i class="dot" style="background:${DOT.high}"></i><span>${esc(r.text)}</span></div>`), false);
  if (queue.length) h += tSection(++n, "buyers", "Buyer search – next up", "Top of the scored queue; tap to open the lead", queue.map(t => {
    const ls = (t.lead_ids || []).map(id => (window._leads || []).find(l => l.id === id)).filter(Boolean);
    return tRow({ go: ls.length === 1 ? "lead:" + ls[0].id : "task:" + t.id, dot: DOT.ok, title: esc(t.task), sub: `Score ${t.score}${t.kind ? " · " + esc(kindName(t.kind)) : ""}${ls.length > 1 ? ` · ${ls.length} leads` : ""}`, right: "" });
  }), false);
  if (br && br.legacy) h += tSection(++n, "old", "Older brief (plain text)", "Refresh to get the new version", br.legacy.split(/\n+/).filter(Boolean).map(l => `<div class="tline">${esc(l)}</div>`), false);
  if (!items.length) h += `<div class="empty">Nothing open. Tap + to add a task.</div>`;
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
    navPush(); view = "deals"; try { localStorage.setItem("view", view); } catch (e) {}
    if (dealFilter === "Closed" && (d.status === "Active" || d.status === "On hold")) dealFilter = "Active";
    openKeys.delete("-deal:" + id); openKeys.add("+deal:" + id);
    if (extra) { const st = (window._steps || []).find(s => s.id === extra); if (st) { if (window.setDealTab) setDealTab(id, "steps"); openKeys.delete(`-stage:${id}:${st.stage}`); openKeys.add(`+stage:${id}:${st.stage}`); openStep = st.id; } }
    saveOpen(); render(); scrollTo(extra ? `[data-step="${extra}"]` : `.deal[data-deal="${id}"]`); return;
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
  if (type === "contact") { navPush(); view = "people"; openPanels.add("contact:" + id); render(); scrollTo(`.ccard[data-cid="${id}"]`); return; }
}
window.goTo = goTo;

$("list").addEventListener("click", async e => {
  const g = e.target.closest("button[data-tgo]"); if (g) { goTo(g.dataset.tgo); return; }
  const w = e.target.closest("button[data-wadraft]");
  if (w) { const d = (window._drafts || []).find(x => String(x.id) === w.dataset.draft); location.href = `https://wa.me/${w.dataset.wadraft}?text=` + encodeURIComponent(d ? d.new_value : ""); return; }
  const c = e.target.closest("button[data-copydraft]");
  if (c) { const d = (window._drafts || []).find(x => String(x.id) === c.dataset.copydraft); try { await navigator.clipboard.writeText(d ? d.new_value : ""); toast("Copied."); } catch (er) { toast("Copy not allowed here – long-press the text."); } return; }
});
