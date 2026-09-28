// Deal Board v17 — the bot that does things (26 Sep 2026, asked by Chris: "the bot must be able to do anything on this app you
// ask. If I tell him I want the deal with [a supplier] on chrome he must bring it up").
// Chris's rule (26 Sep): opening, finding and showing happen at once; every change is prepared as a card and waits for one tap
// ("Do it"). The bot never ticks, confirms, completes or deletes on its own, never sends messages, never shares the private numbers.
//
// 1) Quick commands, worked out in the app itself (free, instant, no Claude call): "open the deal with [a seller] on chrome",
//    "show only transport", "what's overdue", "open the [cargo] numbers", "find [a name]", "open the guide on escrow".
// 2) Everything else goes to the bot (Claude Haiku, the `ask` function). With app:2 it may answer with app actions:
//    open / show / calculator happen at once; change arrives as a "Do it" card.

// ---------- 1) quick commands ----------
const QC_VERB = /^(?:please\s+|can you\s+|could you\s+)?(?:open|show(?:\s+me)?|bring\s+up|pull\s+up|find|go\s+to|take\s+me\s+to|where(?:'s|\s+is|\s+are)|i\s+want(?:\s+to\s+see)?(?:\s+the)?|get\s+me|let\s+me\s+see|look\s+up|search(?:\s+for)?|what(?:'s|\s+is|\s+are)(?:\s+my)?)\b/i;
const QC_CHANGE = /\b(move|make|set|tick|untick|remind|add|note|post|save|follow[\s-]?up|mark|change|update|give\s+it|assign|drop|delete|remove|accept|confirm|rename|write|draft|send|email|whatsapp|chase|new)\b/i;
const QC_STOP = new Set("the a an of on in for with to my our me please deal deals about from that this show open find up bring pull go take where is are it one and his her their see want get let look search what whats what's can you could i we us number details card page".split(" "));
const QC_VIEWS = [
  [/^(today|home|my list|the list|to ?do|tasks?)$/, "worklist", "Today"], [/^(deals?)$/, "deals", "Deals"], [/^(contacts?|people|buyers?|directory|leads?)$/, "leads", "Contacts"],
  [/^(board|notice board|messages?)$/, "board", "Board"], [/^(calculators?|calc|calculator)$/, "calc", "Calculators"], [/^(guides?|playbook|deal kit|kit)$/, "guides", "Guides"],
  [/^(archive|old|history)$/, "archive", "Archive"], [/^(settings)$/, "settings", "Settings"],
];
const QC_TILE = [[/\burgent\b/, "urgent", "urgent"], [/\boverdue\b|\blate\b/, "overdue", "overdue"], [/\bthis week\b|\bweek\b/, "week", "this week"], [/\btoday\b|\bdue today\b/, "today", "due today"]];
const qcNorm = s => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'&.\s-]/g, " ").replace(/\s+/g, " ").trim();
const qcWords = s => qcNorm(s).split(/[\s\-–—→/.,()&]+/).filter(Boolean);
function qcTokens(q) { return qcWords(q.replace(QC_VERB, "")).map(w => w.replace(/'s$/, "")).filter(w => w.length >= 3 && !QC_STOP.has(w)); }
// score one candidate: every query word that starts a word in the candidate counts 1
function qcScore(tokens, hay) { const ws = qcWords(hay).map(w => w.replace(/'s$/, "")); return tokens.reduce((n, t) => n + (ws.some(w => w.startsWith(t)) ? 1 : 0), 0); }
function qcCandidates(q, tokens) {
  const want = /\bdeal\b/.test(q) ? "deal" : /\b(contact|number|phone|person|buyer|supplier|seller)\b/.test(q) ? "person" : /\b(guide|kit|playbook|how|explain|rule|script)\b/.test(q) ? "guide" : /\b(file|pdf|photo|document|doc|icpo|loi|fco|spa|ncnda)\b/.test(q) ? "file" : /\b(task|waiting|wait)\b/.test(q) ? "item" : "";
  const c = [], add = (type, go, name, hay, bonus) => { const s = qcScore(tokens, hay); if (s) c.push({ type, go, name, score: s + (bonus || 0) + (type === want || (want === "person" && (type === "lead" || type === "contact")) ? 0.5 : 0) }); };
  for (const d of window._deals || []) add("deal", "deal:" + d.id, d.name, [d.name, d.area, d.kind === "transport" ? "transport" : "", Object.entries(d.params || {}).filter(([k, v]) => !/^_/.test(k) && typeof v !== "object").map(([, v]) => v).join(" "), d.contacts].join(" "), d.status === "Active" ? 0.2 : 0);
  for (const l of window._leads || []) add("lead", "lead:" + l.id, l.name, [l.name, l.person, l.country].join(" "));
  for (const p of window._lpeople || []) { const l = (window._leads || []).find(x => x.id === p.lead_id); if (l) add("lead", "lead:" + l.id, `${p.name} (${l.name})`, p.name); }
  for (const ct of window._contacts || []) add("contact", "contact:" + ct.id, ct.name, [ct.name, ct.company, ct.role].join(" "));
  for (const it of window._items || []) add("item", "item:" + it.id, `${it._me ? "" : it.waiting_on + ": "}${it.waiting_for}`, [it.waiting_on, it.waiting_for].join(" "), -0.6);
  for (const g of window._library || []) if (["kit", "rule", "script", "country", "site"].includes(g.kind)) add("guide", "guide:" + g.id, g.title, g.title, -0.2);
  for (const a of window._atts || []) add("file", `${a.target_type}:${a.target_id}:file`, a.name, a.name, -0.1);
  // one row per place (a lead found by its name and its person counts once)
  const best = {}; for (const x of c) if (!best[x.go] || best[x.go].score < x.score) best[x.go] = x;
  return Object.values(best).sort((a, b) => b.score - a.score);
}
// returns { go, label } | { choose: [...] } | null
function quickCommand(question) {
  const q = qcNorm(question);
  if (!QC_VERB.test(q) || QC_CHANGE.test(q.replace(QC_VERB, ""))) return null;
  const rest = q.replace(QC_VERB, "").replace(/^(?:\s*(?:the|my|our|me|only|all)\s+)+/, "").replace(/[?.!]+$/, "").trim();
  // pages
  for (const [rx, v, name] of QC_VIEWS) if (rx.test(rest)) return { go: "view:" + v, label: name };
  // sections and tiles: "show only transport", "transport section", "what's overdue", "urgent chrome"
  const secs = typeof sectionsList === "function" ? sectionsList() : [];
  const sec = secs.find(s => new RegExp(`\\b${s.toLowerCase()}\\b`).test(rest));
  const tile = QC_TILE.find(([rx]) => rx.test(rest));
  const restNoSec = sec ? rest.replace(new RegExp(`\\b${sec.toLowerCase()}\\b`), "").replace(/\b(only|section|work|stuff|tasks?|list|things)\b/g, "").trim() : rest;
  if (tile && qcTokens(rest.replace(tile[0], "").replace(sec ? new RegExp(`\\b${sec.toLowerCase()}\\b`) : /$^/, "")).filter(t => !/^(tasks?|things|due|list|only|stuff)$/.test(t)).length === 0) return { go: `show:${sec || ""}:${tile[1]}`, label: `${sec ? sec + " – " : ""}${tile[2]}` };
  if (sec && !restNoSec) return { go: `show:${sec}:`, label: `${sec} only` };
  // numbers / calculator for a deal
  const tokens = qcTokens(rest); if (!tokens.length) return null;
  const wantCalc = tokens.some(t => /^(numbers?|calculator|calc|costing|sums?)$/.test(t));
  const toks = tokens.filter(t => !/^(numbers?|calculator|calc|costing|sums?|guide|file|contact|task|section|only)$/.test(t));
  if (!toks.length) return null;
  const cands = qcCandidates(q, toks);
  if (!cands.length || cands[0].score < 1 || cands[0].score < toks.length * 0.5) return null;   // most of the words must fit
  const top = cands[0], near = cands.filter(x => x !== top && top.score - x.score < 0.5).slice(0, 3);
  if (near.length) return { choose: [top, ...near] };
  if (wantCalc && top.type === "deal") return { go: top.go + ":calc", label: top.name + " – numbers" };
  return { go: top.go, label: top.name };
}
// carry out an "open / show" at once
function botGo(go) {
  const [type, id, extra] = go.split(":");
  if (type === "view") { goView(id); window.scrollTo(0, 0); return; }
  if (type === "show") {
    if (typeof section !== "undefined") { section = id || "All"; try { localStorage.setItem("section", section); } catch (e) {} }
    if (typeof homeFilter !== "undefined") homeFilter = extra || null;
    goView("worklist"); window.scrollTo(0, 0); return;
  }
  if (type === "guide") {
    const g = (window._library || []).find(x => x.id === id); if (!g) return;
    openKeys.add("+lib:" + g.kind); saveOpen(); goView("guides");
    setTimeout(() => { const s = [...document.querySelectorAll(".libi summary")].find(x => x.textContent.trim().startsWith(g.title)); if (s) { s.parentElement.open = true; s.scrollIntoView({ block: "start", behavior: "smooth" }); } }, 60); return;
  }
  if (type === "deal" && extra === "calc") {
    const d = dealById(id); if (!d) return;
    if (d.kind === "transport" && window._trip) {
      const route = ((d.params && d.params.route) || "").split(/→|->| to /), TRp = window._trip;
      if (route.length >= 2) { TRp.from = route[0].replace(/\(.*?\)/g, "").trim(); TRp.to = route[1].split("/")[0].replace(/\(.*?\)/g, "").trim(); }
      const cr = String((d.params || {}).client_rate || "").match(/\d+(?:[.,]\d+)?/); if (cr) TRp.client = cr[0];
      TRp.deal = d.id; TRp.km = null; TRp.geo = null;
      try { localStorage.setItem("calcTab", "transport"); } catch (e) {} if (typeof calcTab !== "undefined") calcTab = "transport";
      goView("calc"); window.scrollTo(0, 0); return;
    }
    if (window.setDealTab) setDealTab(id, "numbers"); goTo("deal:" + id); return;
  }
  if ((type === "item" || type === "deal" || type === "lead" || type === "contact" || type === "task") && extra === "file") {
    goTo(type + ":" + id); if (type === "deal" && window.setDealTab) { setDealTab(id, "notes"); render(); } return;
  }
  goTo(type + ":" + id);
}
window.botGo = botGo;

// ---------- 2) app actions from the bot ----------
const ACT_VIEWS = { today: "worklist", deals: "deals", contacts: "leads", board: "board", calculators: "calc", calculator: "calc", guides: "guides", archive: "archive", settings: "settings" };
function actGo(a) {
  if (a.do === "show") return `show:${a.section && a.section !== "All" ? a.section : ""}:${a.tile && a.tile !== "none" ? a.tile : ""}`;
  if (a.do === "calculator") return null;
  const t = a.target_type, id = String(a.target_id || "");
  if (t === "view") return ACT_VIEWS[id.toLowerCase()] ? "view:" + ACT_VIEWS[id.toLowerCase()] : null;
  if (t === "contact") { const c = (window._contacts || []).find(x => x.id === id || x.name.toLowerCase() === id.toLowerCase()); return c ? "contact:" + c.id : null; }
  if (t === "deal" && a.deal_tab === "numbers") return `deal:${id}:calc`;
  if (t === "deal" && a.deal_tab && window.setDealTab) { setDealTab(id, a.deal_tab); }
  return t && id ? `${t}:${id}` : null;
}
// open the transport calculator with the bot's numbers
function actCalc(a) {
  const c = a.calc || {}, TRp = window._trip; if (!TRp) { goView("calc"); return; }
  const map = { from: "from", to: "to", km: "km", rate_km: "rkm", tolls: "toll", tons_per_load: "tpl", client_per_ton: "client", loads_per_month: "loads" };
  for (const [k, v] of Object.entries(map)) if (c[k] != null && c[k] !== "") TRp[v] = k === "km" ? (parseFloat(c[k]) || null) : String(c[k]);
  if (a.target_type === "deal" && dealById(a.target_id)) TRp.deal = a.target_id;
  if (c.tolls != null && c.tolls !== "") TRp.tollAuto = false;
  const findIt = c.from && c.to && !(c.km > 0);   // places but no distance: work the route out at once (tolls and weather too)
  if (c.from || c.to || c.km) Object.assign(TRp, { plazas: [], geo: null, provider: "", checkKm: null, wx: null, err: "", mins: null });
  try { localStorage.setItem("calcTab", "transport"); } catch (e) {} if (typeof calcTab !== "undefined") calcTab = "transport";
  goView("calc"); window.scrollTo(0, 0);
  if (findIt && typeof tripFind === "function") tripFind();
}
// what a person taps: "Do it" carries out one prepared change (the same saves the app's own buttons make)
async function runAct(a) {
  const v = String(a.value || "").trim(), id = String(a.target_id || "");
  const item = (window._items || []).find(x => x.id === id), deal = dealById(id);
  const itemAct = async (act, val) => {
    if (!item) throw new Error("that task is not on the board any more");
    if (DEMO) { if (act === "due") item.due_on = val || null; if (act === "priority") item.priority = +val; if (act === "assign") item.owner = val; if (act === "confirm") item.state = "Confirmed"; if (act === "done" || act === "drop") window._items = window._items.filter(x => x !== item); if (act === "chased") item.last_chased = new Date().toISOString(); return; }
    const { error } = await sb.rpc("item_action", { p_id: item.id, p_action: act, p_value: val == null ? null : String(val) }); if (error) throw error;
  };
  switch (a.change) {
    case "due": { const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; return itemAct("due", d || null); }
    case "priority": return itemAct("priority", /urgent|high|^1$/i.test(v) ? 1 : /low|^3$/i.test(v) ? 3 : 2);
    case "owner": { const o = /both|us\b/i.test(v) ? "Both" : /anne/i.test(v) ? "Annemarie" : "Chris"; return itemAct("assign", o); }
    case "chased": return itemAct("chased", null);
    case "done": return itemAct("done", null);
    case "drop_item": return itemAct("drop", null);
    case "confirm_item": return itemAct("confirm", null);
    case "follow_up": {
      const [date, ...note] = v.split("|"); const fd = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : workDayPlus(3);
      if (item) return itemAct("due", fd);
      const lid = a.target_type === "lead" ? id : null;
      const t = (window._ltasks || []).find(x => x.id === id) || (window._ltasks || []).filter(x => lid && (x.lead_ids || []).includes(lid) && x.status !== "dropped").sort((x, y) => (x.status === "open" ? 0 : 1) - (y.status === "open" ? 0 : 1))[0];
      if (!t) throw new Error("no buyer-search step found for that lead – add a step first");
      const n = note.join("|").trim() || "No reply yet";
      if (DEMO) { Object.assign(t, { status: "open", not_before: fd, outcome: n, done_by: null, done_at: null }); return; }
      const { error } = await sb.rpc("task_action", { p_id: t.id, p_action: "followup", p_value: fd + "|" + n }); if (error) throw error; return;
    }
    case "tick_step": case "untick_step": {
      const d = deal || dealById((window._steps || []).find(s => s.id === id)?.deal_id); if (!d) throw new Error("deal not found");
      const want = (a.change === "tick_step" ? (a.step || v) : (a.step || v)).toLowerCase();
      const st = (window._steps || []).filter(s => s.deal_id === d.id).find(s => s.id === a.step_id || s.title.toLowerCase() === want) || (window._steps || []).filter(s => s.deal_id === d.id).find(s => want && s.title.toLowerCase().includes(want.slice(0, 24)));
      if (!st) throw new Error("that step is not on the deal's checklist");
      const status = a.change === "tick_step" ? "done" : "open";
      if (DEMO) { Object.assign(st, { status, done_by: status === "done" ? me : null, done_at: status === "done" ? new Date().toISOString() : null }); return; }
      const { error } = await sb.rpc("set_step", { p_id: st.id, p_status: status, p_evidence: a.proof || null }); if (error) throw error; return;
    }
    case "term": {
      if (!deal) throw new Error("deal not found");
      const m = v.match(/^([a-z_]+)\s*=\s*([\s\S]+)$/i); if (!m) throw new Error("the bot did not say which term");
      if (/^(target|limit)$/i.test(m[1])) throw new Error("the private target and walk-away numbers are only set by you, on the deal's Numbers tab");
      const params = { ...(deal.params || {}), [m[1]]: m[2].trim() };
      if (DEMO) { deal.params = params; return; }
      const { error } = await sb.rpc("save_deal", { p_id: deal.id, p_params: params }); if (error) throw error; return;
    }
    case "deal_status": {
      if (!deal) throw new Error("deal not found"); const s = ["Active", "On hold", "Won", "Lost"].find(x => x.toLowerCase() === v.toLowerCase()); if (!s) throw new Error("unknown status");
      if (DEMO) { deal.status = s; return; }
      const { error } = await sb.rpc("save_deal", { p_id: deal.id, p_status: s }); if (error) throw error; return;
    }
    case "new_deal": {
      const [name, secName] = v.split("|").map(x => (x || "").trim()); if (!name) throw new Error("the deal needs a name");
      const area = secName || (typeof section !== "undefined" && section !== "All" ? section : "Other");
      const kind = (typeof SEC_KIND !== "undefined" && SEC_KIND[area]) || (typeof kindOfSection === "function" ? kindOfSection(area) : "general");
      if (DEMO) { const nid = "nd" + Date.now(), now = new Date().toISOString(); (window._deals ||= []).push({ id: nid, name, kind, area, status: "Active", summary: "", stage: "", key_facts: "", contacts: "", next_milestone: "", params: {}, sort: 99, created_at: now, updated_at: now, updated_by: me, kit: kind !== "general", kit_route: kind === "mineral" ? "local" : null }); if (kind !== "general" && window.kitDemoSteps) (window._steps ||= []).push(...kitDemoSteps(nid, kind, "local")); return; }
      const { error } = await sb.rpc("save_deal", { p_id: null, p_name: name, p_kind: kind, p_area: area, p_route: kind === "mineral" ? "local" : null }); if (error) throw error; return;
    }
    case "board_post": {
      if (!v) throw new Error("nothing to post");
      if (DEMO) { (window._posts ||= []).push({ id: "p" + Date.now(), author: me, kind: "post", body: v, deal_id: deal ? deal.id : null, created_at: new Date().toISOString(), pinned: false, done: false }); return; }
      const { error } = await sb.rpc("add_post", { p_body: v, p_deal: deal ? deal.id : null, p_kind: "post" }); if (error) throw error; return;
    }
  }
  throw new Error("the app cannot do that yet");
}
// handle what the bot sent back: open/show/calculator at once (the first one), changes as cards
// a question ("anything risky from … to …?") is answered in words and never jumps to another page (28 Sep 2026): the app only
// opens things at once when the words ask for it (open, show, find, take me to …); otherwise they come as a card to tap
window.botWantsOpen = q => !q || QC_VERB.test(qcNorm(q)) || /\b(calculat|work out the (numbers|route)|numbers for)\b/i.test(q);
window.botApply = function (acts, allowOpen) {
  let opened = null;
  for (const a of acts || []) {
    if (a.do === "change") { chat.push({ role: "act", a, text: a.label || "" }); continue; }
    if (allowOpen === false) { const g = actGo(a); if (g) chat.push({ role: "sys", text: "Tap to open: " + (a.label || g), go: g }); continue; }
    if (opened) { const g = actGo(a); if (g) chat.push({ role: "sys", text: "Also found: " + (a.label || g), go: g }); continue; }
    if (a.do === "calculator") { opened = () => actCalc(a); chat.push({ role: "sys", text: "Opened: " + (a.label || "Transport calculator") }); continue; }
    const g = actGo(a); if (g) { opened = () => botGo(g); chat.push({ role: "sys", text: "Opened: " + (a.label || g) }); }
  }
  return opened;
};

// chat cards for prepared changes and "which one?" choices; Do it / No / tap a choice
document.addEventListener("click", async e => {
  const d = e.target.closest("button[data-actdo]");
  if (d) {
    const i = Number(d.dataset.actdo), m = chat[i]; if (!m || !m.a) return;
    d.disabled = true; d.textContent = "…";
    try { await runAct(m.a); chat.splice(i, 1, { role: "sys", text: "Done: " + (m.a.label || "change saved") + (DEMO ? " (demo – not saved)" : "") }); render(); if (!DEMO) load(); }
    catch (err) { d.disabled = false; d.textContent = "Do it"; chat.splice(i + 1, 0, { role: "sys", text: "Could not do it: " + (err.message || err) }); render(); }
    return;
  }
  const g = e.target.closest("button[data-botgo]");
  if (g) { if (view === "bot") navPush(); botGo(g.dataset.botgo); return; }
  const ex = e.target.closest("button[data-botex]");
  if (ex) { const q = $("q"); if (q) { q.value = ex.dataset.botex; q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }
});

// quick commands run before the bot is asked; returns true when the app handled it itself
window.botQuick = function (question) {
  const r = quickCommand(question); if (!r) return false;
  chat.push({ role: "user", text: question });
  if (r.choose) { chat.push({ role: "choose", text: "Which one?", choose: r.choose.map(x => ({ go: x.go, name: x.name, type: x.type })) }); render(); window.scrollTo(0, document.body.scrollHeight); return true; }
  chat.push({ role: "sys", text: "Opened: " + r.label });
  if (view === "bot") navPush();
  botGo(r.go); return true;
};

// ---------- the info notes on the Ask page: what you can ask (tap one to put it in the box) ----------
// Built from the real deals, people and tasks each time the page is drawn (28 Sep 2026: "only the real deal stuff" – no
// made-up names written into the public code). Where there is nothing to name yet, the example stays general.
function botExamples() {
  const live = (window._deals || []).filter(d => d.status === "Active" || d.status === "On hold");
  const minD = live.find(d => d.kind === "mineral") || null, trD = live.find(d => d.kind === "transport") || null;
  const STOP = /^(the|a|an|and|deal|deals|stockpile|stockpiles|chrome|manganese|transport|haulage|ore|lumpy|rom|fines|concentrate|from|to|for|with|of|on|new|second|mine)$/i;
  const handle = d => { if (!d) return ""; const mid = (String(d.name).split(/\s[–-]\s/)[1] || d.name).split(/\s*(?:→|->|\/)\s*/)[0]; return (mid.match(/[A-Za-z][A-Za-z'’]+/g) || []).find(w => w.length > 2 && !STOP.test(w)) || ""; };
  const first = s => (String(s || "").split(/[\s,(]/).filter(Boolean)[0] || "");
  const mh = handle(minD), mc = ((minD && minD.params && minD.params.commodity) || (minD && minD.area) || "chrome").toLowerCase();
  const cargo = trD ? ((trD.params && trD.params.cargo) || handle(trD) || "transport").toLowerCase() : "transport";
  const people = [...new Set((window._items || []).filter(i => !i._me && i.waiting_on && !/^(me|both)$/i.test(i.waiting_on)).map(i => first(i.waiting_on)).filter(n => n.length > 1))];
  const contacts = (window._contacts || []).map(c => first(c.name)).filter(n => n.length > 1 && !people.includes(n));
  const p1 = people[0] || contacts[0] || "", p2 = people[1] || contacts[0] || p1, p3 = people[2] || contacts[1] || p2;
  const task = (window._items || []).find(i => i.state !== "Proposed" && i.waiting_for && i.waiting_for.length < 40);
  const route = trD && trD.params && trD.params.route ? String(trD.params.route).replace(/\s*\(.*?\)/g, "").replace(/\s*(→|->)\s*/, " to ") : "";
  const dealWord = mh ? `the ${mh} deal` : `the ${mc} deal`;
  return [
    ["Find and open – straight away", [mh ? `Open the deal with ${mh} on ${mc}` : `Open the ${mc} deal`, "Show only transport", "What's overdue?", `Open the ${cargo} numbers`, p1 ? `Find ${p1}` : "Find the transporter", "Open the guide on escrow"]],
    ["Add – you tap Save", [p1 ? `Remind me to call ${p1} on Tuesday` : "Remind me to call the buyer on Tuesday", p2 ? `Waiting on ${p2} for the VAT answer` : "Waiting on the client for the VAT answer", mh ? `New ${mc} deal: ${mh}'s second stockpile` : `New ${mc} deal: next stockpile`, `Note on the ${cargo} deal: the rate is excluding VAT`, "Post on the board: trucks booked for Monday"]],
    ["Change – you tap Do it", [p3 ? `No reply from ${p3}, follow up Tuesday` : "No reply from the seller, follow up Tuesday", task ? `Move "${task.waiting_for}" to Monday` : "Move the permit check to Monday", "Make the VAT question urgent", "Give the CIPC task to Annemarie", `Tick the NCNDA step on ${dealWord}`, "The client rate is now R520 a ton"]],
    ["Write and work out", [p1 ? `WhatsApp to ${p1} about the VAT answer` : "WhatsApp to the client about the VAT answer", p2 ? `Chase prep for ${p2}` : "Chase prep for everyone we wait on", `What's left on ${dealWord} before the ICPO?`, route ? `What do we make on 30 loads ${route} at R26 a km?` : "What do we make on 30 loads at R26 a km?", "Anything risky about this seller?", "Explain FOT and FCA in plain words"]],
  ];
}
window.botHelpHtml = function (dflt) {
  const k = "bot:help", o = isOpen(k, !!dflt);   // open while the chat is empty, folded once you have asked something
  return `<div class="bothelp"><button class="bh-h" data-tog="${k}" data-dflt="${dflt ? 1 : 0}" aria-expanded="${o}">${ic("sparkle")}<span>What you can ask</span><span class="chev"></span></button>${o ? `<div class="bh-b">${botExamples().map(([t, ex]) => `<div class="bh-t">${esc(t)}</div><div class="bh-ex">${ex.map(x => `<button type="button" data-botex="${esc(x)}">${esc(x)}</button>`).join("")}</div>`).join("")}
    <div class="bh-n">Never on its own: ticking, confirming, completing or deleting; sending messages; showing the private target or walk-away numbers; spending money.</div></div>` : ""}</div>`;
};

// ---------- the Ask page's Add row (26 Sep: the + button in the bottom bar was replaced by Ask) ----------
const ASK_ADD = [["task", "checkbox", "Task"], ["deal", "deals", "Deal"], ["contact", "userplus", "Contact"], ["voice", "mic", "Voice note"], ["read", "camera", "Photo or PDF"], ["quote", "chat", "WhatsApp quote"]];
window.botAddHtml = function () {
  return `<div class="askadd-h">Add</div><div class="askadd" role="group" aria-label="Add">${ASK_ADD.map(([a, i, t]) => `<button type="button" data-askadd="${a}"><span class="qi">${ic(i)}</span><span class="aa-l">${t}</span></button>`).join("")}</div>`;
};
document.addEventListener("click", e => { const b = e.target.closest("button[data-askadd]"); if (b && window.doAdd) doAdd(b.dataset.askadd); });
