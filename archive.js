// Deal Board v16 — Archive: search everything (closed deals, done tasks, contacts, leads, notes, board) and warn when a name was used before.
let archQ = "";
const normName = s => String(s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
function nameParts(s) { return normName(s).split(/\s*(?:&|,| and | en |\/)\s*/).map(x => x.trim()).filter(x => x.length > 2 && !["me", "us", "ours", "chris", "annemarie", "chris & annemarie", "chris and annemarie"].includes(x)); }
const woName = i => /^(me|us|ours)$/i.test((i.waiting_on || "").trim()) ? (i.owner || "Chris") : i.waiting_on;
function aHit(icon, tone, go, t1, t2) { return `<button class="ahit t-${tone}"${go ? ` data-tgo="${esc(go)}"` : ""}><span class="ai">${ic(icon)}</span><span class="ax"><span class="a1" style="display:block">${t1}</span>${t2 ? `<span class="a2" style="display:block">${t2}</span>` : ""}</span></button>`; }
// Where does this text appear? (deals incl. closed, open + done tasks, contacts, leads, notes, board)
function findAll(q, opts) {
  opts = opts || {}; const t = normName(q); if (t.length < 3) return null;
  const has = s => normName(s).includes(t);
  const dealText = d => [d.name, d.summary, d.key_facts, d.contacts, d.stage, ...Object.values(d.params || {})].join(" ");
  return {
    deals: (window._deals || []).filter(d => has(dealText(d))),
    open: (window._items || []).filter(i => i.id !== opts.item && (has(i.waiting_on) || has(i.waiting_for) || has(i.blocks) || has(i.next_action))),
    done: (window._done || []).filter(i => has(i.waiting_on) || has(i.waiting_for) || has(i.blocks)),
    contacts: (window._contacts || []).filter(c => c.id !== opts.contact && has([c.name, c.company, c.role, c.notes, c.phone].join(" "))),
    leads: (window._leads || []).filter(l => l.id !== opts.lead && has([l.name, l.person, l.kind, l.phone, l.email, l.about].join(" "))),
    people: (window._lpeople || []).filter(p => has([p.name, p.title, p.email, p.phone].join(" "))),
    notes: (window._notes || []).filter(n => has(n.new_value)),
    posts: (window._posts || []).filter(p => has(p.body)),
  };
}
// Short "seen before" line for a name (used in the task sheet and add forms)
function seenHtml(name, opts) {
  const parts = nameParts(name); if (!parts.length) return "";
  const lines = [];
  for (const p of parts.slice(0, 3)) {
    const r = findAll(p, opts); if (!r) continue;
    const closed = r.deals.filter(d => d.status === "Won" || d.status === "Lost"), live = r.deals.filter(d => !closed.includes(d));
    const bits = [live.length && `${live.length} live deal${live.length > 1 ? "s" : ""} (${live.slice(0, 2).map(d => esc(d.name)).join(", ")})`, closed.length && `${closed.length} closed deal${closed.length > 1 ? "s" : ""} (${closed.slice(0, 2).map(d => esc(d.name) + " – " + esc(d.status)).join(", ")})`,
      r.open.length && `${r.open.length} open task${r.open.length > 1 ? "s" : ""}`, r.done.length && `${r.done.length} done task${r.done.length > 1 ? "s" : ""}, last ${fmtDay(r.done[0].updated_at)}`,
      r.contacts.length && `contact card${r.contacts.length > 1 ? "s" : ""}: ${r.contacts.slice(0, 2).map(c => esc(c.name)).join(", ")}`, (r.leads.length + r.people.length) && `${r.leads.length + r.people.length} in the buyer list`,
      r.notes.length && `${r.notes.length} note${r.notes.length > 1 ? "s" : ""}`, r.posts.length && `${r.posts.length} board message${r.posts.length > 1 ? "s" : ""}`].filter(Boolean);
    if (bits.length) lines.push(`<b style="font-weight:500">${esc(p.replace(/\b\w/g, c => c.toUpperCase()))}</b> used before: ${bits.join(" · ")}`);
  }
  return lines.length ? `<div class="seen">${lines.join("<br>")}<br><button class="linkb" style="padding:0;min-height:26px" data-archq="${esc(parts[0])}">Open in the archive ›</button></div>` : "";
}
window.seenHtml = seenHtml;
function frequentNames() {
  const count = {};
  const add = (s, w) => nameParts(s).forEach(p => { count[p] = (count[p] || 0) + (w || 1); });
  (window._items || []).forEach(i => add(i.waiting_on)); (window._done || []).forEach(i => add(i.waiting_on));
  (window._contacts || []).forEach(c => add(c.name));
  return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 16);
}
function archiveHtml() {
  let h = `<div class="search">${ic("search")}<input id="archQ" type="search" placeholder="Name, company, transporter, phone, deal…" value="${esc(archQ)}" autocomplete="off"></div><div id="archRes">${archResHtml()}</div>`;
  return h;
}
function archResHtml() {
  const r = findAll(archQ);
  if (!r) {
    const fr = frequentNames(), closed = (window._deals || []).filter(d => d.status === "Won" || d.status === "Lost"), done = (window._done || []).slice(0, 12);
    return `<div class="ahits"><h3>People and companies we deal with most</h3><div class="freq">${fr.map(([n, c]) => `<button class="seg sm" data-archq="${esc(n)}">${esc(n.replace(/\b\w/g, x => x.toUpperCase()))} <span>${c}</span></button>`).join("") || `<span class="quiet">Nothing yet.</span>`}</div>
      <h3>Closed deals</h3>${closed.map(d => aHit("deals", "note", "deal:" + d.id, esc(d.name), `${esc(d.status)} · ${esc(d.area)} · updated ${fmtDay(d.updated_at)}`)).join("") || `<div class="quiet">No closed deals yet.</div>`}
      <h3>Recently done</h3>${done.map(i => aHit("check", "ok", "", `${esc(woName(i))}: ${esc(i.waiting_for)}`, `done ${fmtDay(i.updated_at)} · ${esc(i.owner || "")}`)).join("") || `<div class="quiet">Nothing done yet.</div>`}</div>`;
  }
  const n = Object.values(r).reduce((a, x) => a + x.length, 0);
  if (!n) return `<div class="empty">Never seen “${esc(archQ)}” before.</div>`;
  const sec = (title, arr, fn) => arr.length ? `<h3>${title} · ${arr.length}</h3>${arr.slice(0, 25).map(fn).join("")}` : "";
  return `<div class="ahits"><div class="seen" style="margin-top:12px">Found “${esc(archQ)}” ${n} time${n > 1 ? "s" : ""} – it has been used before.</div>` +
    sec("Deals", r.deals, d => aHit(d.kind === "transport" ? "truck" : "gem", "note", "deal:" + d.id, esc(d.name), `${esc(d.status)} · ${esc(d.area)} · updated ${fmtDay(d.updated_at)}`)) +
    sec("Open tasks", r.open, i => aHit("clock", "warn", "item:" + i.id, `${esc(woName(i))}: ${esc(i.waiting_for)}`, `${kindWords(i)} · ${agoWords(i.created_at, "Added")} · ${esc(i.owner || "")}`)) +
    sec("Done tasks", r.done, i => aHit("check", "ok", "", `${esc(woName(i))}: ${esc(i.waiting_for)}`, `done ${fmtDay(i.updated_at)} · ${esc(i.owner || "")}`)) +
    sec("Contacts", r.contacts, c => aHit("user", "call", "contact:" + c.id, esc(c.name), [c.company, c.role, c.phone].filter(Boolean).map(esc).join(" · "))) +
    sec("Buyer and supplier list", r.leads, l => aHit("search", "mail", "lead:" + l.id, esc(l.name), [l.person, l.country, ST[l.status] ? ST[l.status][0] : ""].filter(Boolean).map(esc).join(" · "))) +
    sec("People at listed companies", r.people, p => aHit("user", "mail", "lead:" + p.lead_id, esc(p.name), [p.title, p.email, p.phone].filter(Boolean).map(esc).join(" · "))) +
    sec("Notes", r.notes, x => aHit("note", "note", x.deal_id ? "deal:" + x.deal_id : x.item_id ? "item:" + x.item_id : x.lead_id ? "lead:" + x.lead_id : x.contact_id ? "contact:" + x.contact_id : "", esc(x.new_value.length > 140 ? x.new_value.slice(0, 138) + "…" : x.new_value), `${esc(x.changed_by)} · ${fmtDay(x.changed_at)}`)) +
    sec("Board messages", r.posts, p => aHit("board", "bot", "", esc(p.body.length > 140 ? p.body.slice(0, 138) + "…" : p.body), `${esc(p.author)} · ${fmtDay(p.created_at)}`)) + `</div>`;
}
window.archiveHtml = archiveHtml;
$("list").addEventListener("input", e => {
  if (e.target.id !== "archQ") return; archQ = e.target.value;
  clearTimeout(window._aqT); window._aqT = setTimeout(() => { const b = $("archRes"); if (b) b.innerHTML = archResHtml(); }, 180);
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-archq]"); if (!b) return;
  archQ = b.dataset.archq; window._sheetItem = null;
  if (view !== "archive") goView("archive"); else render();
});
// "Used before" hints while typing names in the add forms
document.addEventListener("input", e => {
  const el = e.target;
  if (!el.matches || !el.matches("#fOn, #tsFrom, #ndName, .cform .c-name, .lf-name")) return;
  clearTimeout(el._seenT); el._seenT = setTimeout(() => {
    let box = el.id === "fOn" ? $("fOnSeen") : el.parentElement.querySelector(".seenbox");
    if (!box) { box = document.createElement("div"); box.className = "seenbox"; el.insertAdjacentElement("afterend", box); }
    const html = el.value.trim().length >= 3 ? seenHtml(el.value) : "";
    if (el.id === "fOn") { box.innerHTML = html ? html.replace(/^<div class="seen">|<\/div>$/g, "") : ""; box.classList.toggle("hidden", !html); } else box.innerHTML = html;
  }, 250);
});
