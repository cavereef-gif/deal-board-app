// Deal Board v11 — Directory (leads), NEXT queue, gates, library, WhatsApp chat import, Email me.
const ST = {
  new: ["Not contacted", "#8A8A92"], ready: ["Ready to send", "#5C7FB8"], contacted: ["Contacted", "#3E9BA6"], replied: ["Replied", "#4FA88A"],
  qualified: ["Qualified", "#8E7CC3"], deal: ["In a deal", "#D9A03F"], parked: ["Parked", "#6B6B72"], bounced: ["Bounced / wrong contact", "#C45C5C"],
  skip: ["Not a target", "#55555C"], dnd: ["Do not deal", "#C45C5C"],
};
const SEGS = [
  ["all", "All"], ["fbuy", "Foreign buyers"], ["sabuy", "SA buyers"], ["sup", "Suppliers"], ["brok", "Brokers"], ["serv", "Services & network"], ["notbuy", "Not buyers"], ["dnd", "Do not deal"],
];
const SIDE_COL = { buyer: "#5C7FB8", supplier: "#4FA88A", broker: "#D9A03F", service: "#8E7CC3", network: "#8E7CC3", competitor: "#6B6B72", other: "#6B6B72" };
const PRIO_W = ["Top", "High", "Medium", "Low", "—"];
const EVID = { verified: "Verified contact", found: "Found – not yet tested", posted: "As posted – unverified", guess: "Guess – test first", unverified: "Unverified", none: "No contact yet", risk: "Risk" };
const VIA = ["Email", "WhatsApp", "Call", "Board message", "Web form", "In person"];
let dSeg = "all", dStat = "any", dQ = "", dCountry = "", dLimit = 40, dOpen = null, dForm = null, dTaskDone = null, dNewLead = false, dEditLead = null, dPersonForm = null;
try { dSeg = localStorage.getItem("dSeg") || "all"; } catch (e) {}

const inSeg = (l, s) => {
  const dnd = l.status === "dnd";
  if (s === "dnd") return dnd;
  if (s === "all") return true;
  if (dnd) return false;
  return s === "fbuy" ? l.side === "buyer" && l.market === "Foreign" : s === "sabuy" ? l.side === "buyer" && l.market === "SA"
    : s === "sup" ? l.side === "supplier" : s === "brok" ? l.side === "broker" : s === "serv" ? (l.side === "service" || l.side === "network")
    : s === "notbuy" ? (l.side === "competitor" || l.side === "other") : true;
};
const leadById = id => (window._leads || []).find(l => l.id === id);
const peopleOf = id => (window._lpeople || []).filter(p => p.lead_id === id).sort((a, b) => a.priority - b.priority || a.sort - b.sort);
const tasksOf = id => (window._ltasks || []).filter(t => (t.lead_ids || []).includes(id));
const leadNotes = id => (window._notes || []).filter(n => n.lead_id === id);
const leadHist = id => (window._lhist || []).filter(e => e.lead_id === id);
const contactOf = l => l.contact_id ? (window._contacts || []).find(c => c.id === l.contact_id) : null;
const gateOpen = k => { const g = (window._gates || []).find(x => x.key === k); return g ? g.status === "open" : false; };
const taskBlocked = t => (t.gates || []).some(gateOpen);
const todaySA = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const initials = n => (n || "?").replace(/\(.*?\)/g, "").split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
const looksMobile = d => (d.startsWith("27") && d.length === 11 && "678".includes(d[2]) && !["86", "87", "80"].includes(d.slice(2, 4))) || (d.startsWith("91") && d.length === 12 && "6789".includes(d[2])) || (d.startsWith("447") && d.length === 12);
function numbersOf(l) {
  const c = contactOf(l);
  const raw = c ? [c.phone].filter(Boolean) : (l.phone || "").split("/").map(s => s.trim()).filter(Boolean);
  return raw.map(p => ({ p, d: toWa(p) }));
}
function waOf(l) {
  const c = contactOf(l);
  if (c && (c.whatsapp || c.phone)) return c.whatsapp || toWa(c.phone);
  if (l.whatsapp) return l.whatsapp;
  const m = numbersOf(l).find(n => looksMobile(n.d)); return m ? m.d : "";
}
const emailOf = l => { const c = contactOf(l); return ((c && c.email) || l.email || "").split("/")[0].trim(); };
function commTile(c) {
  const t = /chrome sand/i.test(c) ? ["Cr", "sand"] : /both/i.test(c) ? ["Cr", "Mn"] : /mangan|mn/i.test(c) ? ["Mn", ""] : /chrome/i.test(c) ? ["Cr", ""] : /transport/i.test(c) ? ["Tr", ""] : null;
  if (!t) return "";
  return `<span class="el" title="${esc(c)}"><b>${t[0]}</b>${t[1] ? `<i>${t[1]}</i>` : ""}</span>`;
}
const stPill = s => `<span class="pill"><i class="dot" style="background:${ST[s][1]}"></i>${ST[s][0]}</span>`;
function libBy(code) { return (window._library || []).find(x => x.kind === "script" && x.meta && x.meta.code === code); }
function fill(body, l, person) {
  const nm = person || (l.person || "").split(/[(,]/)[0].trim() || "Sir/Madam";
  return (body || "").replace(/\[Name\]/g, nm).replace(/\[PERSONAL LINE\]/g, l.personal_line || "").replace(/ {2,}/g, " ");
}
function waText(l) {
  const code = l.side === "supplier" || (l.side === "broker" && /sell/i.test(l.kind)) ? "opener-seller" : "opener-buyer";
  const s = libBy(code); return s ? s.body : "Good day, this is Chris de Jager from Verve Africa in Durban.";
}
function mailOf(l, person) {
  const s = libBy(l.status === "contacted" ? "day7" : (l.template || "E")) || libBy("E");
  const subj = (s.meta && s.meta.subject) || "Chrome and manganese ore from South Africa";
  return { subj, body: fill(s.body, l, person) };
}
function emailMe(subject, body) {
  const to = me === "Annemarie" ? "annemarie.eagar@gmail.com" : "cavereef@gmail.com";
  location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent((body || "").slice(0, 6000))}`;
}
window.emailMe = emailMe;
function leadSummary(l) {
  const ps = peopleOf(l.id).map(p => `- ${p.name}${p.title ? ", " + p.title : ""}${p.email ? " – " + p.email : ""}${p.phone ? " – " + p.phone : ""}`).join("\n");
  const ts = tasksOf(l.id).filter(t => t.status === "open").map(t => `- ${t.task}`).join("\n");
  return [`${l.name} — ${ST[l.status][0]}`, `${l.kind || l.side} · ${[l.location, l.country].filter(Boolean).join(", ")} · ${l.commodity || ""}`,
    l.phone ? "Phone: " + l.phone : "", l.email ? "Email: " + l.email : "", l.grade ? "Wants/offers: " + [l.grade, l.volume, l.terms].filter(Boolean).join("; ") : "",
    l.outcome ? "Last: " + l.outcome : "", l.flag ? "WARNING: " + l.flag : "", ts ? "Next steps:\n" + ts : "", ps ? "People:\n" + ps : "", l.about ? "Notes:\n" + l.about : "",
    l.source ? "Source: " + l.source : ""].filter(Boolean).join("\n");
}

// ---------- queue + gates ----------
function queueHtml() {
  const all = (window._ltasks || []).slice().sort((a, b) => b.score - a.score || a.rank - b.rank);
  const td = todaySA();
  const open = all.filter(t => t.status === "open" && !taskBlocked(t) && (!t.not_before || t.not_before <= td));
  const later = all.filter(t => t.status === "open" && !taskBlocked(t) && t.not_before && t.not_before > td);
  const gated = all.filter(t => t.status === "open" && taskBlocked(t));
  const blocked = all.filter(t => t.status === "blocked");
  const done = all.filter(t => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const gates = (window._gates || []).slice().sort((a, b) => a.sort - b.sort);
  const k = "dq", opn = isOpen(k, true);
  let h = `<div class="deal dq"><div class="deal-h" role="button" tabindex="0" data-tog="${k}" data-dflt="1" aria-expanded="${opn}"><i class="dot d-ok"></i><div class="dh"><div class="dn">Next up — buyer search</div><div class="ds">${open.length} ready · ${gated.length} waiting on a gate${later.length ? ` · ${later.length} later` : ""}</div></div><span class="chev">${opn ? "▾" : "▸"}</span></div>`;
  if (opn) {
    h += `<div class="deal-b"><div class="sec-b">${open.slice(0, 5).map((t, i) => taskHtml(t, i + 1)).join("") || `<div class="quiet">Nothing ready. Clear a gate or add a step.</div>`}</div>`;
    h += `<div class="gates">${gates.filter(g => g.major).map(g => gateHtml(g, all)).join("")}</div>`;
    const sub = (key, title, arr, fn) => arr.length ? `<div class="sec"><div class="sec-h" role="button" tabindex="0" data-tog="dq:${key}" data-dflt="0"><span class="st">${title}</span><span class="cnt">${arr.length}</span><span class="chev">${isOpen("dq:" + key, false) ? "▾" : "▸"}</span></div>${isOpen("dq:" + key, false) ? `<div class="sec-b">${arr.map(fn).join("")}</div>` : ""}</div>` : "";
    h += sub("more", "Rest of the ready queue", open.slice(5), t => taskHtml(t, 0));
    h += sub("later", "Coming up (dated)", later, t => taskHtml(t, 0));
    h += sub("gated", "Waiting on a gate", gated, t => taskHtml(t, 0));
    h += sub("blocked", "Blocked", blocked, t => taskHtml(t, 0));
    h += sub("minor", "Smaller gates", gates.filter(g => !g.major), g => gateHtml(g, all));
    h += sub("done", "Done", done.slice(0, 30), t => taskHtml(t, 0));
    h += `<div class="sec-b"><div class="acts0"><button data-dtasknew="">+ Add a step</button></div>${dForm && dForm.type === "task" && !dForm.lead ? taskFormHtml("") : ""}</div></div>`;
  }
  return h + `</div>`;
}
function gateHtml(g, all) {
  const n = all.filter(t => t.status === "open" && (t.gates || []).includes(g.key)).length;
  return `<div class="gate"><i class="dot" style="background:${g.status === "open" ? "#D9A03F" : "#4FA88A"}"></i><div class="gt"><div class="gn">${esc(g.title)}</div><div class="gs">${g.status === "open" ? "Open" : "Cleared"}${g.note ? " · " + esc(g.note) : ""}${n && g.status === "open" ? ` · holds ${n} step${n > 1 ? "s" : ""}` : ""}</div><div class="gs">Unblocks: ${esc(g.unblocks)}</div></div><button data-dgate="${g.key}">${g.status === "open" ? "Mark cleared" : "Reopen"}</button></div>`;
}
function taskHtml(t, n) {
  const ls = (t.lead_ids || []).map(leadById).filter(Boolean);
  const gated = t.status === "open" && taskBlocked(t);
  const done = t.status === "done";
  let h = `<div class="task${done ? " done" : ""}"><div class="tl">${n ? `<span class="tn">${n}</span>` : ""}<span class="score" title="Value × ease">${t.score}</span><div class="tt">${esc(t.task)}</div></div>
    <div class="tm">${t.kind ? `<span class="pill">${esc(t.kind)}</span>` : ""}${gated ? `<span class="pill"><i class="dot" style="background:#D9A03F"></i>Waits: ${(t.gates || []).filter(gateOpen).map(k => esc(((window._gates || []).find(g => g.key === k) || {}).title || k)).join(", ")}</span>` : ""}${t.not_before && !done ? `<span class="pill">From ${fmtDay(t.not_before)}</span>` : ""}${ls.slice(0, 4).map(l => `<button class="chip" data-dgo="${l.id}">${esc(l.name.length > 24 ? l.name.slice(0, 22) + "…" : l.name)}</button>`).join("")}${ls.length > 4 ? `<span class="pill">+${ls.length - 4} more</span>` : ""}${dTaskDone === t.id ? "" : done || t.status !== "open" ? `<button class="chip tb" data-dtaskact="${t.id}" data-v="reopen">Reopen</button>` : `<button class="chip tb" data-dtaskdone="${t.id}">Done / update</button>`}${t.status === "blocked" ? `<span class="pill"><i class="dot d-high"></i>Blocked${t.blocked_note ? ": " + esc(t.blocked_note) : ""}</span>` : ""}${done ? `<span class="pill"><i class="dot d-ok"></i>${esc(t.done_by || "")} ${t.done_at ? fmtDay(t.done_at) : ""}${t.outcome ? " — " + esc(t.outcome) : ""}</span>` : ""}</div>`;
  if (dTaskDone === t.id) h += `<div class="step-p"><input id="tOut" placeholder="What happened? (one line)" maxlength="300"><div class="acts0"><button class="primary" data-dtaskact="${t.id}" data-v="done">Done ✓</button><button data-dtaskact="${t.id}" data-v="block">Blocked</button><button data-dtaskact="${t.id}" data-v="drop">Drop</button><button data-dtaskdone="">Cancel</button></div></div>`;
  return h + `</div>`;
}
function taskFormHtml(leadId) {
  return `<div class="step-p"><div class="lbl">Next step</div><input id="ntTask" maxlength="300" placeholder="e.g. Call and ask for the buyer's name and email">
    <div class="two"><div><div class="lbl">Value</div><select id="ntVal"><option value="3">3 – unblocks / big</option><option value="2" selected>2 – named / plausible</option><option value="1">1 – unknown</option></select></div>
    <div><div class="lbl">Ease</div><select id="ntEase"><option value="3">3 – under 10 min</option><option value="2" selected>2 – a call or lookup</option><option value="1">1 – long / costs money</option></select></div></div>
    <div class="lbl">Waits for</div><select id="ntGate"><option value="">Nothing – can do now</option><option value="mine">Mine confirmation</option><option value="itac">ITAC (chrome)</option><option value="mine,itac">Mine + ITAC</option></select>
    <div class="acts0"><button class="primary" data-dtasksave="${leadId}">Add step</button><button data-dtasknew="${leadId}">Cancel</button></div></div>`;
}

// ---------- list ----------
function filtered() {
  const q = dQ.trim().toLowerCase();
  let arr = (window._leads || []).filter(l => inSeg(l, dSeg));
  if (dCountry) arr = arr.filter(l => l.country === dCountry);
  if (q) {
    const pp = new Set((window._lpeople || []).filter(p => (p.name + " " + p.email + " " + p.phone).toLowerCase().includes(q)).map(p => p.lead_id));
    const qd = q.replace(/\D/g, "");
    arr = arr.filter(l => pp.has(l.id) || (l.name + " " + l.person + " " + l.country + " " + l.location + " " + l.kind + " " + l.email + " " + l.grade + " " + l.about).toLowerCase().includes(q) || (qd.length > 5 && (l.phone || "").replace(/\D/g, "").includes(qd.replace(/^0/, ""))));
  }
  return arr;
}
function dirHtml() {
  const base = filtered();
  const counts = {}; for (const l of base) counts[l.status] = (counts[l.status] || 0) + 1;
  const list = base.filter(l => dStat === "any" || (dStat === "notyet" ? ["new", "ready"].includes(l.status) : dStat === "done" ? ["contacted", "replied", "qualified", "deal", "bounced"].includes(l.status) : l.status === dStat))
    .sort((a, b) => a.priority - b.priority || ["replied", "qualified", "deal", "ready", "contacted", "new", "bounced", "parked", "skip", "dnd"].indexOf(a.status) - ["replied", "qualified", "deal", "ready", "contacted", "new", "bounced", "parked", "skip", "dnd"].indexOf(b.status) || a.name.localeCompare(b.name));
  const segCount = s => (window._leads || []).filter(l => inSeg(l, s)).length;
  const countries = [...new Set((window._leads || []).filter(l => inSeg(l, dSeg)).map(l => l.country))].sort();
  let h = queueHtml();
  h += `<div class="dtools"><input id="dQ" type="search" placeholder="Search name, company, number, grade…" value="${esc(dQ)}" autocomplete="off">
    <div class="hscroll">${SEGS.map(([k, t]) => `<button class="seg${dSeg === k ? " on" : ""}" data-dseg="${k}">${t} <span>${segCount(k)}</span></button>`).join("")}</div>`;
  const total = base.length || 1;
  h += `<div class="pipe" aria-hidden="true">${Object.keys(ST).filter(s => counts[s]).map(s => `<i style="width:${counts[s] / total * 100}%;background:${ST[s][1]}"></i>`).join("")}</div>`;
  const notyet = (counts.new || 0) + (counts.ready || 0), touched = ["contacted", "replied", "qualified", "deal", "bounced"].reduce((a, s) => a + (counts[s] || 0), 0);
  const chips = [["any", "Any", base.length], ["notyet", "Not contacted yet", notyet], ["done", "Contacted", touched], ...Object.keys(ST).filter(s => counts[s]).map(s => [s, ST[s][0], counts[s]])];
  h += `<div class="hscroll">${chips.map(([k, t, n]) => `<button class="seg sm${dStat === k ? " on" : ""}" data-dstat="${k}">${ST[k] ? `<i class="dot" style="background:${ST[k][1]}"></i>` : ""}${t} <span>${n}</span></button>`).join("")}</div>
    <div class="drow2"><select id="dCountry"><option value="">All countries (${countries.length})</option>${countries.map(c => `<option${c === dCountry ? " selected" : ""}>${esc(c)}</option>`).join("")}</select><button data-dnew="1">${dNewLead ? "Close" : "+ Lead"}</button></div></div>`;
  if (dNewLead) h += `<div class="deal"><div class="sec-b">${leadFormHtml({ side: "buyer", country: "", priority: 2 })}</div></div>`;
  if (dCountry) { const cn = (window._library || []).find(x => x.kind === "country" && (x.title === dCountry || x.title.split(/ \/ /).includes(dCountry))); if (cn) h += `<div class="cnote"><div class="lbl" style="margin-top:0">Country notes · ${esc(cn.title)}</div>${esc(cn.body)}${cn.meta && cn.meta.key ? `<div class="gs">Key names: ${esc(cn.meta.key)}</div>` : ""}</div>`; }
  h += `<div class="lcount">${list.length} shown</div><div class="llist">`;
  h += list.slice(0, dLimit).map(leadRowHtml).join("") || `<div class="empty">Nothing matches. Clear the search or pick another group.</div>`;
  h += `</div>${list.length > dLimit ? `<button class="wide" data-dmore="1">Show ${Math.min(40, list.length - dLimit)} more (${list.length - dLimit} left)</button>` : ""}`;
  h += libraryHtml();
  return h;
}
function leadRowHtml(l) {
  const open = dOpen === l.id;
  const sub = [l.person, l.kind, [l.location, l.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const hasP = numbersOf(l).length, hasE = !!emailOf(l), nt = tasksOf(l.id).filter(t => t.status === "open").length;
  return `<div class="lead p${Math.min(l.priority, 3)}${open ? " open" : ""}" id="lead-${l.id}"><div class="lr" role="button" tabindex="0" data-dopen="${l.id}" aria-expanded="${open}">
    <span class="av" style="box-shadow:0 0 0 2px ${SIDE_COL[l.side] || "#6B6B72"}">${esc(initials(l.name))}</span>
    <div class="lm"><div class="ln">${esc(l.name)}${l.flag ? ` <span class="flagm" title="Warning">⚑</span>` : ""}</div><div class="ls">${esc(sub)}</div>
      <div class="lt">${commTile(l.commodity)}${stPill(l.status)}${l.priority <= 1 ? `<span class="pill"><i class="dot d-high"></i>${PRIO_W[l.priority]}</span>` : ""}${hasP ? `<span class="pill">☎</span>` : ""}${hasE ? `<span class="pill">@</span>` : ""}${nt ? `<span class="pill">${nt} step${nt > 1 ? "s" : ""}</span>` : ""}</div></div>
    <span class="chev">${open ? "▾" : "▸"}</span></div>${open ? leadCardHtml(l) : ""}</div>`;
}
function kv(k, v) { return v ? `<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>` : ""; }
function leadCardHtml(l) {
  const wa = waOf(l), em = emailOf(l), nums = numbersOf(l), c = contactOf(l);
  const deal = l.deal_id ? dealById(l.deal_id) : null;
  const hold = (l.template && l.status !== "contacted") ? (["A", "B", "C", "D", "G"].includes(l.template) || /chrome/i.test(l.commodity) ? ["mine", "itac"] : ["mine"]).filter(gateOpen) : [];
  let h = `<div class="lc">`;
  if (l.flag) h += `<div class="warn"><i class="dot d-high"></i><div>${esc(l.flag)}</div></div>`;
  h += `<div class="bigacts">${nums.length ? `<button data-call="${esc(nums[0].p)}">Call</button>` : ""}${wa ? `<button data-dwa="${l.id}">WhatsApp</button>` : `<button data-dnowa="${l.id}">WhatsApp</button>`}${em ? `<button data-demail="${l.id}">Email</button>` : ""}<button data-demailme="${l.id}">Email me</button><button data-dbot="${l.id}">Bot</button></div>`;
  if (window.draftHtml) h += draftHtml("lead", l.id, wa);
  if (hold.length) h += `<div class="quiet">Hold rule: ${hold.map(k => esc(((window._gates || []).find(g => g.key === k) || {}).title || k)).join(" and ")} still open – check before sending an offer.</div>`;
  const NEXT_ST = { new: ["contacted", "bounced", "skip"], ready: ["contacted", "bounced", "skip"], contacted: ["replied", "contacted", "bounced", "parked"], replied: ["qualified", "deal", "contacted", "parked"], qualified: ["deal", "parked"], deal: ["parked"], parked: ["new", "contacted"], bounced: ["new", "contacted"], skip: ["new"], dnd: ["new"] }[l.status] || ["contacted"];
  h += `<div class="lbl">Status</div><div class="acts0">${stPill(l.status)}${NEXT_ST.map(s => `<button data-dst="${l.id}" data-v="${s}">${s === "contacted" && ["contacted", "replied"].includes(l.status) ? "Contacted again" : ST[s][0]}</button>`).join("")}<select data-dstsel="${l.id}" aria-label="Other status"><option value="">Other…</option>${Object.keys(ST).filter(s => s !== l.status).map(s => `<option value="${s}">${ST[s][0]}</option>`).join("")}</select></div>`;
  if (dForm && dForm.type === "status" && dForm.id === l.id) h += `<div class="step-p"><div class="lbl">${ST[dForm.status][0]} — how and what happened?</div><select id="stVia">${VIA.map(v => `<option>${v}</option>`).join("")}</select><input id="stOut" placeholder="One line, e.g. Wants 40% spec + price FOB Durban" maxlength="300"><div class="acts0"><button class="primary" data-dstsave="${l.id}">Save</button><button data-dstcancel="1">Cancel</button></div></div>`;
  if (l.outcome) h += `<div class="quiet">Last: ${esc(l.outcome)}${l.contacted_at ? ` · contacted ${fmtDay(l.contacted_at)}${l.contacted_via ? " by " + esc(l.contacted_via) : ""}` : ""}${l.replied_at ? ` · replied ${fmtDay(l.replied_at)}` : ""}</div>`;
  const ts = tasksOf(l.id).filter(t => t.status !== "dropped");
  h += `<div class="lbl">Next steps</div>${ts.map(t => taskHtml(t, 0)).join("") || `<div class="quiet">${suggestNext(l)}</div>`}<div class="acts0"><button data-dtasknew="${l.id}">+ Next step</button></div>${dForm && dForm.type === "task" && dForm.lead === l.id ? taskFormHtml(l.id) : ""}`;
  h += `<div class="lbl">Details</div>` + kv("Type", [l.kind, l.side].filter(Boolean)[0]) + kv("Commodity", l.commodity) + kv("Wants / offers", l.grade) + kv("Volume", l.volume) + kv("Price / terms", l.terms) +
    kv("Where", [l.location, l.country].filter(Boolean).join(", ")) + kv("Phone", c ? c.phone : l.phone) + kv("Email", c ? c.email : l.email) + kv("Website", l.website) + kv("Call window", l.call_window) +
    kv("Contact quality", EVID[l.evidence]) + kv("Priority", PRIO_W[l.priority]) + kv("Reply via", l.board_ref) + kv("Template", l.template) + kv("Personal line", l.personal_line) +
    kv("Checks needed", l.checks_needed) + kv("What was checked", l.checked) + kv("Source", [l.source, l.source_date].filter(Boolean).join(" · ")) + kv("Owner", l.owner) + kv("Deal", deal ? deal.name : "");
  if (l.source_url) h += `<div class="acts0"><a class="btnlink" href="${esc(l.source_url)}" target="_blank" rel="noopener">Open source</a>${em ? `<a class="btnlink" href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent(em)}" target="_blank" rel="noopener">Find in Gmail</a>` : ""}</div>`;
  else if (em) h += `<div class="acts0"><a class="btnlink" href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent(em)}" target="_blank" rel="noopener">Find in Gmail</a></div>`;
  if (l.about) h += `<div class="lbl">Research notes</div><div class="about">${esc(l.about)}</div>`;
  const ps = peopleOf(l.id);
  h += `<div class="lbl">People (${ps.length})</div>${ps.map(p => personHtml(l, p)).join("")}<div class="acts0"><button data-dpnew="${l.id}">+ Person</button></div>${dPersonForm && dPersonForm.lead === l.id ? personFormHtml(l.id, dPersonForm.p || {}) : ""}`;
  const k = "lead:" + l.id, ns = leadNotes(l.id), fN = attsFor("lead", l.id).length;
  h += `<div class="acts0"><button data-panel="${k}"${openPanels.has(k) ? ' style="background:var(--tab-on)"' : ""}>Notes ${ns.length} · Files ${fN}</button><button data-dchat="lead:${l.id}">Import WhatsApp chat</button><button data-dedit="${l.id}">${dEditLead === l.id ? "Close edit" : "Edit"}</button><select data-dleaddeal="${l.id}" aria-label="Deal"><option value="">${deal ? "Remove from deal" : "Link to a deal…"}</option>${liveDeals().map(d => `<option value="${d.id}"${deal && deal.id === d.id ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>`;
  if (openPanels.has(k)) h += `<div class="npanel" style="margin-left:0"><div class="lbl">Notes</div>${notesBlock(ns, "lead", l.id)}<div class="lbl">Files</div>${filesHtml("lead", l.id)}</div>`;
  if (dEditLead === l.id) h += `<div class="step-p">${leadFormHtml(l)}</div>`;
  const hs = leadHist(l.id);
  if (hs.length) h += `<details class="hdet"><summary>History (${hs.length})</summary>${hs.slice(0, 30).map(e => `<div class="hist">${esc(e.field === "lead:status" ? "Status: " + e.old_value + " → " + e.new_value : e.field.startsWith("lead:") ? `${e.field.slice(5)}: ${(e.old_value || "—").slice(0, 80)} → ${(e.new_value || "—").slice(0, 120)}` : e.new_value || "")}<div class="hm">${esc(e.changed_by)} · ${fmtWhen(e.changed_at)}</div></div>`).join("")}</details>`;
  return h + `</div>`;
}
function suggestNext(l) {
  const ch = l.channel;
  if (l.status === "ready") return "Suggested: send the email (template " + (l.template || "E") + ") once the gates allow.";
  if (l.status === "contacted") return "Suggested: follow up if no reply (Day 7, then Day 21, then stop).";
  if (l.status === "bounced") return "Suggested: find a working address.";
  if (["skip", "dnd", "parked"].includes(l.status)) return "No action – see status.";
  return ch === "call" ? "Suggested: call and ask for the buyer's name and email." : ch === "whatsapp" ? "Suggested: WhatsApp profile check, then the opener." : ch === "form" ? "Suggested: open their own contact page and send the outreach." : ch === "board" ? "Suggested: reply through the board (" + (l.board_ref || "board") + ")." : ch === "email" ? "Suggested: email them." : "Suggested: find a contact (company site, then switchboard or LinkedIn).";
}
function personHtml(l, p) {
  const wa = p.whatsapp || (looksMobile(toWa(p.phone)) ? toWa(p.phone) : "");
  return `<div class="person"><span class="av sm">${esc(initials(p.name))}</span><div class="pm"><div class="pn">${esc(p.name)}${p.priority === 0 ? ` <span class="pill"><i class="dot d-high"></i>Top</span>` : ""}</div><div class="ls">${esc(p.title)}</div>
    ${p.email ? `<div class="ls">${esc(p.email)}</div>` : ""}${p.phone ? `<div class="ls">${esc(p.phone)}</div>` : ""}${p.email_note ? `<div class="ls">${esc(p.email_note)}</div>` : ""}${p.note ? `<div class="ls">${esc(p.note)}</div>` : ""}
    <div class="acts0">${p.phone ? `<button data-call="${esc(p.phone)}">Call</button>` : ""}${wa ? `<button data-dpwa="${p.id}">WhatsApp</button>` : ""}${p.email ? `<button data-dpmail="${p.id}">Email</button>` : ""}<button data-dpedit="${p.id}">Edit</button></div></div></div>`;
}
function personFormHtml(leadId, p) {
  const f = (k, lbl, t) => `<div class="lbl">${lbl}</div><input class="pf-${k}" type="${t || "text"}" value="${esc(p[k] || "")}" autocomplete="off">`;
  return `<div class="step-p">${f("name", "Name")}${f("title", "Title / role")}${f("email", "Email", "email")}${f("phone", "Phone", "tel")}${f("note", "Note")}
    <div class="acts0"><button class="primary" data-dpsave="${p.id || ""}" data-lead="${leadId}">Save person</button>${p.id ? `<button data-dprm="${p.id}">Remove</button>` : ""}<button data-dpnew="">Cancel</button>${"contacts" in navigator ? `<button data-dpick="pf">Pick from phone</button>` : ""}</div></div>`;
}
function leadFormHtml(l) {
  const f = (k, lbl, t) => `<div class="lbl">${lbl}</div><input class="lf-${k}" type="${t || "text"}" value="${esc(l[k] ?? "")}" autocomplete="off">`;
  const sel = (k, lbl, opts) => `<div class="lbl">${lbl}</div><select class="lf-${k}">${opts.map(([v, t]) => `<option value="${v}"${String(l[k]) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  return `${f("name", "Name (company or person)")}${f("person", "Contact person")}
    <div class="two"><div>${sel("side", "Side", [["buyer", "Buyer"], ["supplier", "Supplier"], ["broker", "Broker"], ["service", "Service"], ["network", "Network"], ["competitor", "Competitor"], ["other", "Other"]])}</div><div>${sel("priority", "Priority", [[0, "Top"], [1, "High"], [2, "Medium"], [3, "Low"]])}</div></div>
    <div class="two"><div>${f("country", "Country")}</div><div>${f("commodity", "Commodity")}</div></div>
    ${f("phone", "Phone(s) – separate with /", "tel")}${f("email", "Email", "email")}${f("grade", "Wants / offers (grade)")}${f("volume", "Volume")}${f("terms", "Price / terms")}${f("source", "Where it came from")}
    <div class="lbl">Research notes</div><textarea class="lf-about">${esc(l.about || "")}</textarea>
    <div class="acts0"><button class="primary" data-dsave="${l.id || ""}">Save</button>${"contacts" in navigator ? `<button data-dpick="lf">Pick from phone</button>` : ""}</div><div class="msg" id="lfMsg"></div>`;
}
function libraryHtml() {
  const L = window._library || [];
  const grp = (kind, title, fn) => { const arr = L.filter(x => x.kind === kind).sort((a, b) => a.sort - b.sort); const k = "lib:" + kind, o = isOpen(k, false);
    return `<div class="sec"><div class="sec-h" role="button" tabindex="0" data-tog="${k}" data-dflt="0"><span class="st">${title}</span><span class="cnt">${arr.length}</span><span class="chev">${o ? "▾" : "▸"}</span></div>${o ? `<div class="sec-b">${arr.map(fn).join("")}</div>` : ""}</div>`; };
  const item = x => `<details class="libi"><summary>${esc(x.title)}${x.meta && x.meta.code && x.meta.code.length === 1 ? ` <span class="pill">${esc(x.meta.code)}</span>` : ""}</summary><div class="about">${x.meta && x.meta.subject ? "Subject: " + esc(x.meta.subject) + "\n\n" : ""}${esc(x.body)}</div>${x.kind === "script" ? `<div class="acts0"><button data-dcopy="${x.id}">Copy</button><button data-demailme-lib="${x.id}">Email me</button></div>` : ""}</details>`;
  const site = x => `<details class="libi"><summary>${esc(x.title)}${x.meta.status ? ` <span class="pill">${esc(x.meta.status)}</span>` : ""}</summary><div class="about">${esc(x.body)}${x.meta.cost ? "\nCost: " + esc(x.meta.cost) : ""}${x.meta.notes ? "\n" + esc(x.meta.notes) : ""}${x.meta.group ? "\n" + esc(x.meta.group) : ""}</div>${x.meta.link ? `<div class="acts0"><a class="btnlink" href="${esc(x.meta.link)}" target="_blank" rel="noopener">Open site</a></div>` : ""}</details>`;
  const ctry = x => `<details class="libi"><summary>${esc(x.title)} <span class="pill">${esc(x.meta.companies || 0)} on list</span></summary><div class="about">${esc(x.meta.focus)}\n${esc(x.body)}\nKey names: ${esc(x.meta.key)}</div></details>`;
  const chk = x => `<div class="hist">${esc(x.meta.date)} · ${esc(x.title)} — ${esc(x.body)}<div class="hm">${esc(x.meta.how)} · ${esc(x.meta.where)}</div></div>`;
  return `<div class="deal libx"><div class="sec-b" style="padding-top:12px"><div class="dn">Playbook</div><div class="ds">From your buyer list: how it works, scripts, countries, sites, checks.</div></div>${grp("rule", "How this list works (rules)", item)}${grp("script", "Scripts and templates", item)}${grp("country", "Country notes", ctry)}${grp("site", "Sites and sign-ups", site)}${grp("check", "Checks log", chk)}</div>`;
}
window.dirHtml = dirHtml;
